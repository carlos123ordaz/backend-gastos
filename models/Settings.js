const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  montoInicial: {
    type: Number,
    required: [true, 'El monto inicial es requerido'],
    default: 0,
    min: [0, 'El monto inicial no puede ser negativo']
  },
  fechaInicio: {
    type: Date,
    default: Date.now
  },
  descripcion: {
    type: String,
    default: 'Configuración del sistema'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);