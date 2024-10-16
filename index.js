const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../config/mysql');
const authenticateToken = require('../config/auth');



let checkLogin = (req, res, next) => {

    let token = req.cookies.token;

    if (!token) {
        return next();
    }

    jwt.verify(token, 'your_jwt_secret', (error, user) => {
        if (error) throw error;

        if (user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }

        if (user.role === 'user') {
            return res.redirect('/user/dashboard');
        }
        next();
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads')
    },
    filename: (req, file, cb) => {
        const originalname = file.originalname;
        cb(null, originalname)
    }
});
const upload = multer({ storage: storage });


router.post('/user/profile', authenticateToken, upload.fields([{ name: 'profile', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    try {
        
        // ডাটাবেস থেকে আগের প্রোফাইল এবং ব্যানার তথ্য বের করা
        const sqlSelect = "SELECT profile, banner FROM users WHERE id = ?";
        db.query(sqlSelect, [req.user.userid], (error, results) => {
            if (error) {
                return res.status(500).send('Error fetching current profile and banner');
            }

            let profile = results[0].profile; // আগের প্রোফাইল ইমেজ
            let banner = results[0].banner;   // আগের ব্যানার ইমেজ

            if (req.files && req.files['profile'] && req.files['profile'][0]) {
                profile = req.files['profile'][0].filename;
            }

            if (req.files && req.files['banner'] && req.files['banner'][0]) {
                banner = req.files['banner'][0].filename;
            }

            const sqlUpdate = "UPDATE users SET profile = ?, banner = ? WHERE id = ?";
            db.query(sqlUpdate, [profile, banner, req.user.userid], (error, results) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Error updating profile and banner');
                }

                let message = encodeURIComponent('updated compleate ...');
                res.redirect(`/user/dashboard?message=${message}`);
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/home', authenticateToken, async (req, res) => {
    if (req.user.role !== 'user') {
        return res.redirect('/admin/dashboard');
    }

    let sql = 'SELECT * FROM post';
    db.query(sql, [req.user.userid], async (error, results) => {
        if (error) throw error;
        res.render('home', { role: 'user', errorMessage: req.query.errorMessage, message: req.query.message, deleteMessage: req.query.deleteMessage, allPost: results });
    });
});

router.post('/home', upload.single('image'), authenticateToken, async (req, res, next) => {
    let { title, message } = req.body;

    if (!title || !message) {
        let errorMessage = encodeURIComponent('Title image and Message are required');
        return res.redirect(`/home?errorMessage=${errorMessage}`);
    }

    let image;
    if (req.file) {
        image = req.file.filename;
    }

    if (!image) {
        let errorMessage = encodeURIComponent('At least one image is required');
        return res.redirect(`/home?errorMessage=${errorMessage}`);
    }

    let sql = 'INSERT INTO post (title, image, message, userid) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, image, message, req.user.userid], async (error, results) => {
        if (error) throw error;

        let message = encodeURIComponent('Post successfully uploaded ...');
        return res.redirect(`/home?message=${message}`)
    });
});

router.get('/invoice', (req, res) => {
    res.render('invoice');
});

router.get('/register', checkLogin, async (req, res) => {
    res.render('users/register', { errorMessage: req.query.errorMessage, successMessage: req.query.successMessage });
});

router.post('/register', checkLogin, async (req, res) => {
    try {
        let { username, email, password } = req.body;

        if (!username || !email || !password) {
            let errorMessage = encodeURIComponent('Username Email Password are required');

            return res.redirect(`/register?errorMessage=${errorMessage}`);
        }

        let checkUserSql = 'SELECT * FROM users WHERE username = ? OR email = ?';
        await db.query(checkUserSql, [username, email], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('server error');
            }

            if (results.length > 0) {
                let user = results[0];

                if (user.username === username && user.email === email) {
                    let errorMessage = encodeURIComponent('Username and Email allready Exist');
                    return res.redirect(`/register?errorMessage=${errorMessage}`);

                } else if (user.username === username) {
                    let errorMessage = encodeURIComponent('Username allready Exist');
                    return res.redirect(`/register?errorMessage=${errorMessage}`);

                } else if (user.email === email) {
                    let errorMessage = encodeURIComponent('Email allready Exist');
                    return res.redirect(`/register?errorMessage=${errorMessage}`);
                }
            }

            let hashPassword = await bcrypt.hash(password, 10);
            let sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
            db.query(sql, [username, email, hashPassword], (error, results) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('server error');
                }

                let insertId = results.insertId;

                jwt.sign({ userid: insertId, role: 'user' }, 'your_jwt_secret', { expiresIn: '365d' }, async (error, token) => {
                    if (error) {
                        console.error(error);
                        return res.status(500).send('server error');
                    }

                    if (token) {
                        res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 365 * 24 * 60 * 60 * 1000 });
                        res.redirect('/user/dashboard');
                    }
                });
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('server error');
    }
});


router.get('/login', checkLogin, async (req, res) => {
    res.render('users/login', { SetSid: req.query.SetSid });
});

router.post('/login', checkLogin, async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            let errorMessage = encodeURIComponent('Email and Password are required');
            return res.redirect(`/login?SetSid=${errorMessage}`)
        }

        let checkUserSqlsql = 'SELECT * FROM users WHERE email = ?';
        db.query(checkUserSqlsql, [email], async (error, results) => {
            if (error) throw error;

            if (results.length === 0) {
                let errorMessage = encodeURIComponent('Invalid Email address');
                return res.redirect(`/login?SetSid=${errorMessage}`);
            }

            let user = results[0];
            let match = await bcrypt.compare(password, user.password);

            if (!match) {
                let errorMessage = encodeURIComponent('Invalid Password');
                return res.redirect(`/login?SetSid=${errorMessage}`);
            }

            let userid = user.id;
            jwt.sign({ role: user.role, userid }, 'your_jwt_secret', { expiresIn: '365d' }, async (error, token) => {
                if (error) throw error;

                if (token) {
                    res.cookie('token', token, { httpOnly: true, secure: true, maxAge: 365 * 24 * 60 * 60 * 1000 });
                    if (user.role === 'admin') {
                        res.redirect(`/admin/dashboard`);
                    } else {
                        res.redirect(`/user/dashboard`);
                    }
                }
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/admin/dashboard', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT username, email, role, profile FROM users WHERE id = ?';
        let UserSql = 'SELECT * FROM users';
        let heroSql = 'SELECT * FROM hero';
        let servicesSql = 'SELECT * FROM services';
        let productSql = 'SELECT * FROM product';
        let footerSql = 'SELECT * FROM footer';
        let userPostSql = 'SELECT * FROM post';

        db.query(sql, [req.user.userid], async (error, results) => {
            if (error) throw error;

            db.query(heroSql, async (error1, results1) => {
                if (error1) throw error1;

                db.query(servicesSql, async (error2, results2) => {
                    if (error2) throw error2;

                    db.query(productSql, async (error3, results3) => {
                        if (error3) throw error3;

                        db.query(footerSql, async (error4, results4) => {
                            if (error4) throw error4;

                            db.query(UserSql, async (error5, results5) => {
                                if (error5) throw error5;

                                db.query(userPostSql, async (error6, results6) => {
                                    if (error6) throw error6;

                                    if (results.length === 0) {
                                        return res.status(404).send('User not found');
                                    }

                                    const user = results[0];

                                    if (req.user.role !== 'admin') {
                                        return res.redirect('/login');
                                    } else {
                                        res.render('adminDashboard', { role: 'admin', user, hero: results1, services: results2, product: results3, footer: results4, users: results5, post: results6 });
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/user/dashboard', authenticateToken, async (req, res) => {

    let sql = 'SELECT username, email, role, profile, banner FROM users WHERE id = ?';
    let postSql = 'SELECT * FROM post WHERE userid = ?';

    db.query(sql, [req.user.userid], async (error, results) => {
        if (error) throw error;

        db.query(postSql, [req.user.userid], async (error1, results1) => {
            if (error1) throw error1;

            if (results.length === 0) {
                res.clearCookie('token', { httpOnly: true, secure: true });
                res.redirect('/login');
            }

            let user = results[0];

            if (req.user.role !== 'user') {
                return res.redirect('/login');
            } else {
                res.render('userDashboard', { role: 'user', user, post: results1 });
            }

        });
    });
});


// router.get('/user/dashboard', authenticateToken, (req, res) => {
//     if (req.user.role !== 'user') {
//         return res.redirect('/login');
//     } else {
//         res.render('userDashboard', { role: 'user' });
//     }
// });


router.get('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, secure: true });
    res.redirect('/login');
});



router.get('/', checkLogin, async (req, res) => {
    try {
        let sql = 'SELECT * FROM hero';
        let sql1 = 'SELECT * FROM services';
        let sql2 = 'SELECT * FROM product';
        let sql3 = 'SELECT * FROM footer';

        db.query(sql, async (error, results) => {
            if (error) throw error;

            db.query(sql1, async (error1, results1) => {
                if (error1) throw error1;

                db.query(sql2, async (error2, results2) => {
                    if (error2) throw error2;

                    db.query(sql3, async (error3, results3) => {
                        if (error3) throw error3;
                        res.render('index', { hero: results, services: results1, product: results2, footer: results3 });
                    });
                });
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});





// router.post('/user/post', upload.array('photos', 1220), authenticateToken, async (req, res) => { 
//     try { 
//         let { title, message } = req.body;

//         // Title এবং Message চেক করা
//         if (!title || !message) {
//             let errorMessage = encodeURIComponent('Title and Message are required');
//             return res.redirect(`/user/post?errorMessage=${errorMessage}`);
//         }

//         let images = [];

//         // যদি ফাইল থাকে তবে তা লুপের মাধ্যমে images অ্যারেতে যুক্ত করা হবে
//         if (req.files && req.files.length > 0) {
//             req.files.forEach(file => {
//                 images.push(file.filename);
//             });
//         }

//         if (images.length === 0) {
//             let errorMessage = encodeURIComponent('At least one image is required');
//             return res.redirect(`/user/post?errorMessage=${errorMessage}`);
//         }

//         // Image গুলিকে join করে স্ট্রিং আকারে স্টোর করা হচ্ছে (ডাটাবেসে একসাথে সংরক্ষণ করতে হলে)
//         let imageList = images.join(',');

//         let sql = 'INSERT INTO post (title, images, message, userid) VALUES (?, ?, ?, ?)';
//         db.query(sql, [title, imageList, message, req.user.userid], async (error, results) => {
//             if (error) throw error;

//             let message = encodeURIComponent('Title and message saved successfully with images.');
//             return res.redirect(`/user/post?message=${message}`);
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).send('Server error');
//     }
// });

// for (let index = 1; index <= 1; index++) {
//     console.log(index);
// }


router.get('/user/post', authenticateToken, async (req, res) => {
    let sql = 'SELECT id, title, message, image FROM post WHERE userid = ?';
    db.query(sql, [req.user.userid], async (error, results) => {
        if (error) throw error;
        res.render('post', { role: 'user', errorMessage: req.query.errorMessage, message: req.query.message, deleteMessage: req.query.deleteMessage, count: results });
    });
});

router.post('/user/post', upload.single('image'), authenticateToken, async (req, res, next) => {
    let { title, message } = req.body;

    if (!title || !message) {
        let errorMessage = encodeURIComponent('Title image and Message are required');
        return res.redirect(`/user/post?errorMessage=${errorMessage}`);
    }

    let image;
    if (req.file) {
        image = req.file.filename;
    }

    if (!image) {
        let errorMessage = encodeURIComponent('At least one image is required');
        return res.redirect(`/user/post?errorMessage=${errorMessage}`);
    }

    let sql = 'INSERT INTO post (title, image, message, userid) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, image, message, req.user.userid], async (error, results) => {
        if (error) throw error;

        let message = encodeURIComponent('Post successfully uploaded ...');
        return res.redirect(`/user/post?message=${message}`)
    });
});



router.get('/user/post/delete/:id', async (req, res) => {
    var sql = 'DELETE FROM post WHERE id = ?';
    db.query(sql, [req.params.id], async (error, results) => {
        if (error) throw error;

        let deleteMessage = encodeURIComponent('Your Post Deleted Successfully compleated ..');
        return res.redirect(`/user/post?deleteMessage=${deleteMessage}`)
    });
});

// router.post('/user/profile', authenticateToken, upload.fields([{ name: 'profile', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
//     const sqlSelect = "SELECT profile, banner FROM users WHERE id = ?";
//     db.query(sqlSelect, [req.user.id], async (error, results) => {
//         if (error) throw error;

//         // let profile = results[0].profile; // আগের প্রোফাইল ইমেজ
//         // let banner = results[0].banner;   // আগের ব্যানার ইমেজ

//         if (req.files && req.files['profile'] && req.files['profile'][0]) {
//             profile = req.files['profile'][0].filename;
//         }

//         if (req.files && req.files['banner'] && req.files['banner'][0]) {
//             banner = req.files['banner'][0].filename;
//         }

//         const sqlUpdate = "UPDATE users SET profile = ?, banner = ? WHERE id = ?";
//         db.query(sqlUpdate, [profile, banner, req.user.id], (error, results) => {
//             if (error) throw error;

//             let message = encodeURIComponent('Profile Update successfull ..');
//             res.redirect(`/user/dashboard?message=${message}`);
//         });
//     });
// });

module.exports = router;


// <---- erp development route ---->
// router.get('/requisition', (req, res) => {
//     const sql = 'SELECT * FROM requisition';
//     db.query(sql, (error, results) => {
//         if (error) throw error;
//         res.render('invoice/requisition', { requisition: results });
//     });
// });

// router.post('/requisition', async (req, res) => {
//     const { reference, quantity, price } = req.body;
//     let sql = 'INSERT INTO requisition (reference, quantity, price) VALUES (?, ?, ?)';
//     await db.query(sql, [reference, quantity, price], (error, results) => {
//         if (error) throw error;
//         res.redirect('/requisition');
//     });
// });

// router.get('/item', (req, res) => {
//     res.render('item');
// });
// router.post('/item', async (req, res) => {
//     try {
//         let { names } = req.body;
//         names = Array.isArray(names) ? names : [names];
//         const triplets = [];
//         for (let i = 0; i < names.length; i += 3) {
//             triplets.push([names[i], names[i + 1] || null, names[i + 2] || null]);
//         }
//         const sql = 'INSERT INTO requisition (reference, quantity, price) VALUES ?'; // Ensure correct column names here
//         await db.query(sql, [triplets]);
//         res.render('item', { message: 'Stock Add Successfully' });
//     } catch (error) {
//         console.error('Error saving items:', error);
//         return res.status(500).send('Internal Server Error');
//     }
// });

// router.get('/find', (req, res) => {
//     res.render('find');
// });
// router.get('/getData', (req, res) => {
//     let references = req.query.references.split(','); // Expecting comma-separated values
//     let sql = 'SELECT * FROM requisition WHERE reference IN (?)';

//     db.query(sql, [references], (error, results) => {
//         if (error) {
//             console.error('Error fetching data:', error);
//             return res.status(500).send('Error fetching data');
//         }
//         if (results.length === 0) {
//             return res.status(404).send('No data found');
//         }
//         return res.json(results);
//     });
// });

// Short and Easy Code for invoice 
// router.post('/invoice', async (req, res) => {
//     const { reference, quantity, price, sellquantity, sellprice } = req.body;
//     try {
//         await db.beginTransaction();
//         for (let i = 0; i < reference.length; i++) {
//             const referenceVal = reference[i];
//             const quantityVal = quantity[i];
//             const priceVal = price[i];
//             const sellquantityVal = sellquantity[i];
//             const sellpriceVal = sellprice[i];
//             await db.query('INSERT INTO invoice (reference, quantity, price, sellquantity, sellprice) VALUES (?, ?, ?, ?, ?)', [referenceVal, quantityVal, priceVal, sellquantityVal, sellpriceVal]);
//             await db.query('UPDATE requisition SET quantity = quantity - ? WHERE reference = ?', [sellquantityVal, referenceVal]);
//         }
//         await db.commit();
//         res.redirect('/find');
//     } catch (error) {
//         await db.rollback();
//         console.error('Error processing invoices:', error);
//         res.status(500).send('Error processing invoices');
//     }
// });
// Short and Easy Code for invoice 


// Full details Code for invoice 
// router.post('/invoice', async (req, res) => {
//     const invoices = [];
//     // Extracting data from request body
//     const { reference, quantity, price, sellquantity, sellprice } = req.body;
//     try {
//         // Start transaction
//         await db.beginTransaction();
//         for (let i = 0; i < reference.length; i++) {
//             const referenceVal = reference[i];
//             const quantityVal = quantity[i];
//             const priceVal = price[i];
//             const sellquantityVal = sellquantity[i];
//             const sellpriceVal = sellprice[i];
//             // Inserting into invoice table
//             const sql = 'INSERT INTO invoice (reference, quantity, price, sellquantity, sellprice) VALUES (?, ?, ?, ?, ?)';
//             await db.query(sql, [referenceVal, quantityVal, priceVal, sellquantityVal, sellpriceVal]);
//             // Updating item table
//             const updateItemSql = 'UPDATE requisition SET quantity = quantity - ? WHERE reference = ?';
//             await db.query(updateItemSql, [sellquantityVal, referenceVal]);
//         }
//         // Commit transaction
//         await db.commit();
//         res.redirect('/find');
//     } catch (error) {
//         // Rollback transaction if any error occurs
//         await db.rollback();
//         console.error('Error processing invoices:', error);
//         res.status(500).send('Error processing invoices');
//     }
// });
// Full details Code for invoice 

// router.get('/delete/:id', (req, res) => {
//     const sql = 'DELETE FROM requisition WHERE id = ?';
//     db.query(sql, [req.params.id], (error, results) => {
//         if (error) throw error;
//         res.redirect('/requisition');
//     });
// });

// router.post('/find', (req, res, next) => {
//     const reference = req.body.reference;
//     const sql = 'SELECT * FROM requisition WHERE reference = ?';
//     db.query(sql, [reference], (error, results) => {
//         if (error) {
//             console.error("Error querying database:", error);
//             return res.status(500).send("Internal Server Error");
//         }
//         if (results.length === 0) {
//             return res.status(404).send("Reference not found plese Enter Valid Reference");
//         }
//         res.render('invoice/invoice', { requisition: results[0] });
//     });
// });

// router.post('/sell', (req, res) => {
//     const { reference, quantity, sellqty, sellprice } = req.body;
//     const balance = quantity - sellqty;
//     const sql = 'UPDATE requisition SET quantity = ? WHERE reference = ?';
//     db.query(sql, [balance, reference], (error, results) => {
//         if (error) throw error;
//         const totalSellPrice = sellqty * sellprice;
//         const insertSql = 'INSERT INTO invoice (reference, quantity, sellqty, sellprice, totalSellPrice) VALUES (?, ?, ?, ?, ?)';
//         db.query(insertSql, [reference, quantity, sellqty, sellprice, totalSellPrice], (error, results) => {
//             if (error) throw error;
//             res.redirect('/find');
//         });
//     });
// });


// router.post('/invoice', async (req, res) => {
//     const { reference, quantity, price, sellquantity, sellprice } = req.body;
//     try {
//         await db.beginTransaction();
//         let totalSellValue = 0; // মোট sellvalue সংরক্ষণ করার জন্য একটি ভেরিয়েবল
//         for (let i = 0; i < reference.length; i++) {
//             const referenceVal = reference[i];
//             const quantityVal = quantity[i];
//             const priceVal = price[i];
//             const sellquantityVal = sellquantity[i];
//             const sellpriceVal = sellprice[i];
//             const sellValue = sellquantityVal * sellpriceVal; // sellquantity এবং sellprice গুন করা
//             totalSellValue += sellValue; // মোট sellvalue যোগ করা

//             await db.query('INSERT INTO invoice (reference, quantity, price, sellquantity, sellprice, sellValue) VALUES (?, ?, ?, ?, ?, ?)', [referenceVal, quantityVal, priceVal, sellquantityVal, sellpriceVal, sellValue]);
//             await db.query('UPDATE requisition SET quantity = quantity - ? WHERE reference = ?', [sellquantityVal, referenceVal]);
//         }
//         await db.commit();
//         res.json({ message: 'Invoices processed successfully', totalSellValue: totalSellValue }); // মোট sellvalue রেসপন্সে পাঠানো
//     } catch (error) {
//         await db.rollback();
//         console.error('Error processing invoices:', error);
//         res.status(500).send('Error processing invoices');
//     }
// });





// module.exports = router;
