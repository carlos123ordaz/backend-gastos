const Settings = require('../models/Settings');

// @desc    Obtener configuración
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({ montoInicial: 0 });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración',
      error: error.message
    });
  }
};

// @desc    Actualizar configuración
exports.updateSettings = async (req, res) => {
  try {
    const { montoInicial, descripcion } = req.body;

    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({
        montoInicial: montoInicial || 0,
        descripcion: descripcion || 'Configuración del sistema'
      });
    } else {
      if (typeof montoInicial !== 'undefined') settings.montoInicial = montoInicial;
      if (descripcion) settings.descripcion = descripcion;
      await settings.save();
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
      error: error.message
    });
  }
};