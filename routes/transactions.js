const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../config/multer');

router.get('/', protect, getTransactions);
router.get('/:id', protect, getTransaction);
router.post('/', protect, admin, upload.single('documento'), createTransaction);
router.put('/:id', protect, admin, upload.single('documento'), updateTransaction);
router.delete('/:id', protect, admin, deleteTransaction);


module.exports = router;