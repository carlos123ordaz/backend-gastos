const multer = require('multer');

// Configuración de multer para manejar archivos en memoria
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Aceptar solo imágenes y PDFs
  console.log(file)
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo imágenes y PDFs'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
 limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024, 
    fields: 10,
    files: 1 
  }
});

module.exports = upload;