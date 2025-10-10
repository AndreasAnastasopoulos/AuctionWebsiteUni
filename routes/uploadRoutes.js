const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Check file type
function checkFileType(file, cb) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

// Initialize upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 10000000 }, // 10MB limit
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).array('images', 5); // 'images' is the field name from your form, 5 is the max count

// @route   POST /api/upload
// @desc    Upload images
// @access  Private (you can add auth middleware here)
router.post('/', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err });
        }
        if (req.files === undefined || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files selected!' });
        }

        // Return the paths of the uploaded files
        const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
        res.status(200).json({
            success: true,
            message: 'Images uploaded successfully',
            imageUrls: imageUrls
        });
    });
});

module.exports = router;