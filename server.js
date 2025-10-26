const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
    }
});

// File filter - accepts all file types
const fileFilter = (req, file, cb) => {
    cb(null, true); // Accept all files
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max file size (adjust as needed)
    }
});

// Routes

// Home route - serves the UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload single file
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded' 
            });
        }

        const fileUrl = `${req.protocol}://$${req.get('host')}/files/$$ {req.file.filename}`;
        
        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: fileUrl,
                downloadUrl: `${req.protocol}://$${req.get('host')}/download/$$ {req.file.filename}`
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error uploading file',
            error: error.message 
        });
    }
});

// Upload multiple files
app.post('/upload-multiple', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No files uploaded' 
            });
        }

        const filesData = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: `${req.protocol}://$${req.get('host')}/files/$$ {file.filename}`,
            downloadUrl: `${req.protocol}://$${req.get('host')}/download/$$ {file.filename}`
        }));

        res.json({
            success: true,
            message: `${req.files.length} files uploaded successfully`,
            data: filesData
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error uploading files',
            error: error.message 
        });
    }
});

// Serve files directly (view in browser)
app.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ 
            success: false, 
            message: 'File not found' 
        });
    }

    res.sendFile(filepath);
});

// Download files (force download)
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ 
            success: false, 
            message: 'File not found' 
        });
    }

    res.download(filepath);
});

// Get all uploaded files
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        
        const filesData = files.map(filename => {
            const filepath = path.join(uploadsDir, filename);
            const stats = fs.statSync(filepath);
            
            return {
                filename: filename,
                size: stats.size,
                uploadDate: stats.birthtime,
                url: `${req.protocol}://$${req.get('host')}/files/$$ {filename}`,
                downloadUrl: `${req.protocol}://$${req.get('host')}/download/$$ {filename}`
            };
        });

        res.json({
            success: true,
            count: filesData.length,
            data: filesData
        });
    } catch (error) {
        console.error('Error reading files:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error reading files',
            error: error.message 
        });
    }
});

// Delete file
app.delete('/api/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'File not found' 
            });
        }

        fs.unlinkSync(filepath);
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting file',
            error: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Ladybug server is running!',
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File is too large. Maximum size is 100MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🐞 Ladybug Server is running on port ${PORT}`);
    console.log(`📁 Upload directory: ${uploadsDir}`);
});
