const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/mysql');
const authenticateToken = require('../config/auth');
const { userCheck, adminCheck } = require('../config/test');


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

router.post('/profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'profile', banner: 1 }]), authenticateToken, async (req, res) => {

    let sql = 'SELECT profile, banner FROM users WHERE id = ?';
    db.query(sql, [req.user.userid], async (error, results) => {
        if (error) throw error;

        let profile = results[0].profile;
        let banner = results[0].banner;

        if (req.files && req.files['profile'] && req.files['profile'][0]) {
            profile = req.files['profile'][0].filename;
        }

        if (req.files && req.files['banner'] && req.files['banner'][0]) {
            banner = req.files['banner'][0].filename;
        }

        let updateSql = 'UPDATE users SET profile = ?, banner = ? WHERE id = ?';
        db.query(updateSql, [profile, banner, req.user.userid], async (error, results) => {
            if (error) throw error;

            let message = encodeURIComponent('UPDATE successfully Compleated ..');
            res.redirect(`/admin/dashboard?message=${message}`);
        });
    });
});


router.get('/hero', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            // return res.status(403).send('Access denied');
            return res.render('error', { role: 'user' });
        }

        let sql = 'SELECT * FROM hero';
        db.query(sql, async (error, results) => {
            if (error) throw error;
            res.render('services/hero', { message: req.query.message, errorMessage: req.query.errorMessage, deleteMessage: req.query.deleteMessage, hero: results, role: 'admin' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.post('/hero', authenticateToken, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'cv', maxCount: 1 }]), async (req, res) => {
    try {
        let { colorText, smallTitle, contact, message, secondMessage } = req.body;

        if (!colorText || !smallTitle || !contact || !message || !secondMessage) {
            let errorMessage = encodeURIComponent('Color Text, Small Title, Contact, Message, Second Message are required');
            return res.redirect(`/admin/hero?errorMessage=${errorMessage}`);
        }

        let image;
        if (req.files && req.files['image']) {
            image = req.files['image'][0].filename;
        }

        if (!image) {
            let errorMessage = encodeURIComponent('Image is required');
            return res.redirect(`/admin/hero?errorMessage=${errorMessage}`);
        }

        let cv;
        if (req.files && req.files['cv']) {
            cv = req.files['cv'][0].filename;
        }

        if (!cv) {
            let errorMessage = encodeURIComponent('CV is required');
            return res.redirect(`/admin/hero?errorMessage=${errorMessage}`);
        }

        const sql = "INSERT INTO hero (colorText, smallTitle, contact, message, secondMessage, image, cv) VALUES (?, ?, ?, ?, ?, ?, ?)";
        await db.query(sql, [colorText, smallTitle, contact, message, secondMessage, image, cv], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            let message = encodeURIComponent('Hero has been Save successfully Compleated..');
            res.redirect(`/admin/hero?message=${message}`);
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/heroEdit/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM hero WHERE id = ?';
        await db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;

            if (results.length > 0) {
                return res.render('services/heroEdit', { hero: results[0], role: 'admin' });
            } else {
                return res.redirect('/admin/hero');
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.post('/hero/edit/:id', authenticateToken, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'cv', maxCount: 1 }]), async (req, res) => {
    try {
        const { id } = req.params;
        const { colorText, smallTitle, contact, message, secondMessage, existingImage, existingCv } = req.body;

        // পুরনো ইমেজ এবং সিভি ধরে রাখা
        let image = existingImage;
        let cv = existingCv;

        // যদি নতুন ইমেজ আপলোড করা হয়, তাহলে নতুন ইমেজ ব্যবহার করা হবে
        if (req.files && req.files['image'] && req.files['image'][0]) {
            image = req.files['image'][0].filename;
        }

        // যদি নতুন সিভি আপলোড করা হয়, তাহলে নতুন সিভি ব্যবহার করা হবে
        if (req.files && req.files['cv'] && req.files['cv'][0]) {
            cv = req.files['cv'][0].filename;
        }

        // SQL আপডেট কোয়েরি
        const sql = "UPDATE hero SET colorText = ?, smallTitle = ?, contact = ?, message = ?, secondMessage = ?, image = ?, cv = ? WHERE id = ?";
        await db.query(sql, [colorText, smallTitle, contact, message, secondMessage, image, cv, id], (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            let message = encodeURIComponent('Hero data updated successfully...');
            res.redirect(`/admin/hero?message=${message}`);
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/hero/delete/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'DELETE FROM hero WHERE id = ?';
        await db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;
            let deleteMessage = encodeURIComponent('Hero has been deleted successfully Compleated..');
            res.redirect(`/admin/hero?deleteMessage=${deleteMessage}`);
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});



router.get('/services', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM services';
        await db.query(sql, async (error, results) => {
            if (error) throw error;
            res.render('services/services', { services: results, role: 'admin', errorMessage: req.query.errorMessage, message: req.query.message, deleteMessage: req.query.deleteMessage });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/servicesEdit/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM services WHERE id = ?'
        db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;

            if (results.length > 0) {
                return res.render('services/servicesEdit', { services: results[0], role: 'admin' })
            } else {
                return res.redirect('/admin/services');
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/services/delete/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'DELETE FROM services WHERE id = ?';
        await db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;
            let deleteMessage = encodeURIComponent('Service delete Successfull...');
            res.redirect(`/admin/services?deleteMessage=${deleteMessage}`);
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.post('/services', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        let { heading, message } = req.body;

        if (!heading || !message) {
            let errorMessage = encodeURIComponent('Heading Image Message are required');
            return res.redirect(`/admin/services?errorMessage=${errorMessage}`);
        }

        let image;
        if (req.file) {
            image = req.file.filename;
        }

        if (!image) {
            let errorMessage = encodeURIComponent('At least one image is required');
            return res.redirect(`/admin/services?errorMessage=${errorMessage}`);
        }


        const sql = "INSERT INTO services ( heading, image, message) VALUES (?, ?, ?)";
        await db.query(sql, [heading, image, message], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            let message = encodeURIComponent('Services save Successfull...');
            return res.redirect(`/admin/services?message=${message}`);
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});



router.get('/product', authenticateToken, (req, res) => {
    res.render('services/product', { role: 'admin' });
});



router.get('/product/view', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM product';
        await db.query(sql, async (error, results) => {
            if (error) throw error;
            res.render('services/productView', { product: results, role: 'admin' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/product/delete/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'DELETE FROM product WHERE id = ?';
        await db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;
            res.redirect('/admin/product/view');
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.post('/product', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        let { heading, message } = req.body;

        if (!heading || !message) {
            return res.render('services/product', { role: 'admin', message: 'Heading and Image and Message are required' });
        }

        let image;
        if (req.file) {
            image = req.file.filename;
        }

        if (!image) {
            return res.render('services/product', { role: 'admin', message: 'At least one image is required' });
        }


        const sql = "INSERT INTO product ( heading, image, message) VALUES (?, ?, ?)";
        db.query(sql, [heading, image, message], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            return res.render('services/product', { role: 'admin', successMessage: 'My Product Data Save Successfull... ' });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/footer', authenticateToken, (req, res) => {
    res.render('services/footer', { role: 'admin' });
});

router.post('/footer', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        let { email, contact, message } = req.body;

        if (!email || !contact || !message) {
            return res.render('services/footer', { role: 'admin', message: 'Logo - Email address - contact and © Copyright Message are required' });
        }

        let image;
        if (req.file) {
            image = req.file.filename;
        }

        if (!image) {
            return res.render('services/footer', { role: 'admin', message: 'At least one Logo is required' });
        }


        const sql = "INSERT INTO footer (email, contact, image, message) VALUES (?, ?, ?, ?)";
        await db.query(sql, [email, contact, image, message], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            return res.render('services/footer', { role: 'admin', successMessage: 'Footer Component Save Successfull ' });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/footer/view', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM footer';
        await db.query(sql, async (error, results) => {
            if (error) throw error;
            res.render('services/footerView', { footer: results, role: 'admin' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/footer/delete/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'DELETE FROM footer WHERE id = ?';
        db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;
            res.redirect('/admin/footer/view');
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/adminUpdateRole', authenticateToken, adminCheck, (req, res) => {
    res.render('adminUpdateRole', { successMessage: req.query.successMessage, role: 'admin' });
});

router.post('/adminUpdateRole', authenticateToken, adminCheck, (req, res) => {
    let { newrole, id } = req.body;

    let sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.query(sql, [newrole, id], async (error, results) => {
        if (error) throw error;

        if (results.affectedRows === 0) {
            return res.render('adminUpdateRole', { role: 'admin', errorMessage: 'User not found' });
        }
        
        let successMessage = encodeURIComponent('Role successfully Updated ..');
        return res.redirect(`/admin/adminUpdateRole?successMessage=${successMessage}`);
    });
});














// router.get('/update-Role', authenticateToken, adminCheck, (req, res) => {
//     res.render('admin-Update-Role', { role: 'admin' });
// });

// // অ্যাডমিন রোল আপডেট রাউট
// router.post('/update-role', authenticateToken, adminCheck, (req, res) => {

//     const { newRole, nomanId } = req.body;

//     const updateRoleSql = "UPDATE users SET role = ? WHERE id = ?";
//     db.query(updateRoleSql, [newRole, nomanId], (error, results) => {
//         if (error) {
//             console.error(error);
//             return res.status(500).send('Server error');
//         }

//         if (results.affectedRows === 0) {
//             return res.render('admin-Update-Role', { message: 'User not found', role: 'admin' });
//         }

//         res.render('admin-Update-Role', { successMessage: 'User role updated successfully', role: 'admin' });
//     });
// });


router.get('/all/users', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM users';

        db.query(sql, async (error, results) => {
            if (error) throw error;
            res.render('users/allUsers', { deleteMessage: req.query.deleteMessage, user: results, role: 'admin' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

router.get('/users/delete/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'DELETE FROM users WHERE id = ?';
        db.query(sql, [req.params.id], async (error, results) => {
            if (error) throw error;
            let deleteMessage = encodeURIComponent('User account has been deleted successfully');
            res.redirect(`/admin/all/users?deleteMessage=${deleteMessage}`);
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


router.get('/users/edit/:id', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT * FROM users WHERE id = ?';
        db.query(sql, [req.params.id], async (error, results) => {
            if (error)
                if (error) throw error;
            if (results.length === 0) {
                let message = encodeURIComponent('User not found');
                return res.redirect(`/admin/all/users?message=${message}`);
            }
            res.render('users/editUser', { user: results[0], role: 'admin' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});


module.exports = router;

