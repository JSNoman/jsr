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
    destination: function (req, file, cb) {
        cb(null, 'public/uploads')
    },
    filename: (req, file, cb) => {
        const originalname = file.originalname;
        cb(null, originalname)
    }
});
const upload = multer({ storage: storage });

// let systemBreak = (req, res, next) => {
//     if (req.user.role !== 'user') {
//         return res.redirect('/user/dashboard');
//     } else {
//         return res.redirect('/admin/dashboard');
//     }
// }

// router.get('/home', authenticateToken, systemBreak, async (req, res) => {
//     let sql = 'SELECT * FROM post';
//     db.query(sql, [req.user.userid], async (error, results) => {
//         if (error) throw error;
//         res.render('home', { role: 'user', errorMessage: req.query.errorMessage, message: req.query.message, deleteMessage: req.query.deleteMessage, allPost: results });
//     });
// });


router.post('/stock', (req, res) => {
    try {
        let { names } = req.body;
        names = Array.isArray(names) ? names : [names];
        triplets = [];
        for (let i = 0; i < names.length; i += 3) {
            triplets.push([names[i], names[i + 1] || null, names[i + 2] || null]);
        }
        let sql = 'INSERT INTO stock (reference, quantity, price) VALUES ?';
        db.query(sql, [triplets]);
        res.render('item');
    } catch (error) {

    }
});

router.post('/item', (req, res) => {
    try {
        let { names } = req.body;
        names = Array.isArray(names) ? names : [names];
        let triplets = [];
        for (let i = 0; i < names.length; i += 3) {
            triplets.push([names[i], names[i + 1] || null, names[i + 2] || null]);
        }
        let sql = 'INSERT INTO stock (reference, quantity, price) VALUES ?';
        console.log('Item save successfully');
        res.redirect('/item');
    } catch (error) {
        console.error('item saving error', error);
        return res.status(500).send('Internal Server error');
    }
    res.render('item');
});


module.exports = router;