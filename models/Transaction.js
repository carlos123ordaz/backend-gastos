const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  fecha: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    default: Date.now
  },
  monto: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0, 'El monto no puede ser negativo']
  },
  tipo: {
    type: String,
    required: [true, 'El tipo es requerido'],
    enum: ['ingreso', 'gasto']
  },
  tipoGasto: {
    type: String,
    enum: ['alimentacion', 'transporte', 'servicios', 'salud', 'educacion', 'entretenimiento', 'vivienda', 'otros', 'N/A'],
    default: 'N/A'
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true
  },
  observaciones: {
    type: String,
    trim: true,
    default: ''
  },
  documento: {
    url: {
      type: String,
      default: ''
    },
    nombre: {
      type: String,
      default: ''
    },
    tipo: {
      type: String,
      enum: ['image', 'pdf', ''],
      default: ''
    }
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Validación para tipoGasto
transactionSchema.pre('save', function(next) {
  if (this.tipo === 'ingreso') {
    this.tipoGasto = 'N/A';
  } else if (this.tipo === 'gasto' && this.tipoGasto === 'N/A') {
    this.tipoGasto = 'otros';
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);