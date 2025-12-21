const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

// @desc    Obtener resumen del dashboard
exports.getResumen = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    // Construir filtro de fecha
    const filter = {};
    if (fechaInicio || fechaFin) {
      filter.fecha = {};
      if (fechaInicio) filter.fecha.$gte = new Date(fechaInicio);
      if (fechaFin) filter.fecha.$lte = new Date(fechaFin);
    }

    // Obtener configuración del monto inicial
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ montoInicial: 0 });
    }

    // Calcular totales
    const ingresos = await Transaction.aggregate([
      { $match: { ...filter, tipo: 'ingreso' } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);

    const gastos = await Transaction.aggregate([
      { $match: { ...filter, tipo: 'gasto' } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);

    const totalIngresos = ingresos.length > 0 ? ingresos[0].total : 0;
    const totalGastos = gastos.length > 0 ? gastos[0].total : 0;

    // Calcular balance
    const balance = settings.montoInicial + totalIngresos - totalGastos;

    // Gastos por categoría
    const gastosPorCategoria = await Transaction.aggregate([
      { $match: { ...filter, tipo: 'gasto' } },
      { $group: { _id: '$tipoGasto', total: { $sum: '$monto' } } },
      { $sort: { total: -1 } }
    ]);

    // Transacciones recientes
    const transaccionesRecientes = await Transaction.find(filter)
      .sort({ fecha: -1 })
      .limit(10)
      .populate('creadoPor', 'nombre email');

    // Ingresos y gastos por mes (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transaccionesPorMes = await Transaction.aggregate([
      {
        $match: {
          fecha: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            mes: { $month: '$fecha' },
            año: { $year: '$fecha' },
            tipo: '$tipo'
          },
          total: { $sum: '$monto' }
        }
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        montoInicial: settings.montoInicial,
        totalIngresos,
        totalGastos,
        balance,
        gastosPorCategoria: gastosPorCategoria.map(item => ({
          categoria: item._id,
          total: item.total
        })),
        transaccionesRecientes,
        transaccionesPorMes
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del dashboard',
      error: error.message
    });
  }
};

// @desc    Obtener estadísticas detalladas
exports.getEstadisticas = async (req, res) => {
  try {
    const totalTransacciones = await Transaction.countDocuments();
    const totalIngresos = await Transaction.countDocuments({ tipo: 'ingreso' });
    const totalGastos = await Transaction.countDocuments({ tipo: 'gasto' });

    // Promedio de ingresos y gastos
    const promedioIngreso = await Transaction.aggregate([
      { $match: { tipo: 'ingreso' } },
      { $group: { _id: null, promedio: { $avg: '$monto' } } }
    ]);

    const promedioGasto = await Transaction.aggregate([
      { $match: { tipo: 'gasto' } },
      { $group: { _id: null, promedio: { $avg: '$monto' } } }
    ]);

    // Mayor ingreso y mayor gasto
    const mayorIngreso = await Transaction.findOne({ tipo: 'ingreso' })
      .sort({ monto: -1 })
      .populate('creadoPor', 'nombre');

    const mayorGasto = await Transaction.findOne({ tipo: 'gasto' })
      .sort({ monto: -1 })
      .populate('creadoPor', 'nombre');

    res.json({
      success: true,
      data: {
        totalTransacciones,
        totalIngresos,
        totalGastos,
        promedioIngreso: promedioIngreso.length > 0 ? promedioIngreso[0].promedio : 0,
        promedioGasto: promedioGasto.length > 0 ? promedioGasto[0].promedio : 0,
        mayorIngreso,
        mayorGasto
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};