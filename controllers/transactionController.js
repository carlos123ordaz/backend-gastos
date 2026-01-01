const Transaction = require('../models/Transaction');
const { uploadToGCS, deleteFromGCS, getFileNameFromUrl } = require('../config/googleCloud');

// @desc    Obtener todas las transacciones
exports.getTransactions = async (req, res) => {
  try {
    const { tipo, tipoGasto, fechaInicio, fechaFin, search, page = 1, limit = 20 } = req.query;

    // Construir filtro
    const filter = {};
    
    if (tipo) filter.tipo = tipo;
    if (tipoGasto && tipoGasto !== 'N/A') filter.tipoGasto = tipoGasto;
    
    if (fechaInicio || fechaFin) {
      filter.fecha = {};
      if (fechaInicio) filter.fecha.$gte = new Date(fechaInicio);
      if (fechaFin) filter.fecha.$lte = new Date(fechaFin);
    }

    // Búsqueda por descripción
    if (search && search.trim()) {
      filter.descripcion = { $regex: search.trim(), $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .populate('creadoPor', 'nombre email')
      .sort({ fecha: -1, _id: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      count: transactions.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener transacciones',
      error: error.message
    });
  }
};

// @desc    Obtener transacción por ID
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('creadoPor', 'nombre email');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener transacción',
      error: error.message
    });
  }
};

// @desc    Crear nueva transacción
exports.createTransaction = async (req, res) => {
  try {
    const { fecha, monto, tipo, tipoGasto, descripcion, observaciones } = req.body;

    // Validaciones básicas
    if (!fecha || !monto || !tipo || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: fecha, monto, tipo, descripcion'
      });
    }

    const transactionData = {
      fecha,
      monto,
      tipo,
      tipoGasto: tipoGasto || (tipo === 'ingreso' ? 'N/A' : 'otros'),
      descripcion,
      observaciones: observaciones || '',
      creadoPor: req.user._id
    };

    // Si hay archivo, subirlo a Google Cloud Storage
    if (req.file) {
      const documentoData = await uploadToGCS(req.file);
      transactionData.documento = documentoData;
    }

    const transaction = await Transaction.create(transactionData);

    await transaction.populate('creadoPor', 'nombre email');

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear transacción',
      error: error.message
    });
  }
};

// @desc    Actualizar transacción
exports.updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada'
      });
    }

    const { fecha, monto, tipo, tipoGasto, descripcion, observaciones, eliminarDocumento } = req.body;

    // Actualizar campos
    if (fecha) transaction.fecha = fecha;
    if (monto) transaction.monto = monto;
    if (tipo) transaction.tipo = tipo;
    if (tipoGasto) transaction.tipoGasto = tipoGasto;
    if (descripcion) transaction.descripcion = descripcion;
    if (observaciones !== undefined) transaction.observaciones = observaciones;

    // Manejar documento
    if (eliminarDocumento === 'true' && transaction.documento.url) {
      // Eliminar documento existente
      const fileName = getFileNameFromUrl(transaction.documento.url);
      await deleteFromGCS(fileName);
      transaction.documento = { url: '', nombre: '', tipo: '' };
    }

    if (req.file) {
      // Si hay documento anterior, eliminarlo
      if (transaction.documento.url) {
        const fileName = getFileNameFromUrl(transaction.documento.url);
        await deleteFromGCS(fileName);
      }
      // Subir nuevo documento
      const documentoData = await uploadToGCS(req.file);
      transaction.documento = documentoData;
    }

    await transaction.save();
    await transaction.populate('creadoPor', 'nombre email');

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar transacción',
      error: error.message
    });
  }
};

// @desc    Eliminar transacción
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transacción no encontrada'
      });
    }

    // Eliminar documento de Google Cloud Storage si existe
    if (transaction.documento.url) {
      const fileName = getFileNameFromUrl(transaction.documento.url);
      await deleteFromGCS(fileName);
    }

    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Transacción eliminada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar transacción',
      error: error.message
    });
  }
};