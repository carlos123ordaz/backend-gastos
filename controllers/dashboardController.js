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

    // Ejecutar consultas en paralelo
    const [settings, totalesPorTipo, gastosPorCategoria, transaccionesPorMes] = await Promise.all([
      // Obtener configuración (con caché si es posible)
      Settings.findOne().lean(),
      
      // Calcular ingresos y gastos en una sola consulta
      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$monto' }
          }
        }
      ]),
      
      // Gastos por categoría
      Transaction.aggregate([
        { $match: { ...filter, tipo: 'gasto' } },
        { 
          $group: { 
            _id: '$tipoGasto', 
            total: { $sum: '$monto' } 
          } 
        },
        { $sort: { total: -1 } }
      ]),
      
      // Transacciones por mes (últimos 6 meses)
      Transaction.aggregate([
        {
          $match: {
            fecha: { 
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
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
      ])
    ]);

    // Crear settings si no existe
    let finalSettings = settings;
    if (!settings) {
      finalSettings = await Settings.create({ montoInicial: 0 });
    }

    // Procesar totales
    const totalIngresos = totalesPorTipo.find(t => t._id === 'ingreso')?.total || 0;
    const totalGastos = totalesPorTipo.find(t => t._id === 'gasto')?.total || 0;
    const balance = finalSettings.montoInicial + totalIngresos - totalGastos;

    res.json({
      success: true,
      data: {
        montoInicial: finalSettings.montoInicial,
        totalIngresos,
        totalGastos,
        balance,
        gastosPorCategoria: gastosPorCategoria.map(item => ({
          categoria: item._id,
          total: item.total
        })),
        transaccionesPorMes
      }
    });
  } catch (error) {
    console.error('Error en getResumen:', error);
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
    // Ejecutar todas las consultas en paralelo
    const [conteos, promedios, extremos] = await Promise.all([
      // Conteos por tipo en una sola consulta
      Transaction.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            porTipo: [
              { $group: { _id: '$tipo', count: { $sum: 1 } } }
            ]
          }
        }
      ]),
      
      // Promedios de ingresos y gastos en una sola consulta
      Transaction.aggregate([
        {
          $group: {
            _id: '$tipo',
            promedio: { $avg: '$monto' }
          }
        }
      ]),
      
      // Mayor ingreso y mayor gasto en paralelo
      Promise.all([
        Transaction.findOne({ tipo: 'ingreso' })
          .sort({ monto: -1 })
          .populate('creadoPor', 'nombre')
          .lean(),
        Transaction.findOne({ tipo: 'gasto' })
          .sort({ monto: -1 })
          .populate('creadoPor', 'nombre')
          .lean()
      ])
    ]);

    // Procesar resultados de conteos
    const totalTransacciones = conteos[0].total[0]?.count || 0;
    const totalIngresos = conteos[0].porTipo.find(t => t._id === 'ingreso')?.count || 0;
    const totalGastos = conteos[0].porTipo.find(t => t._id === 'gasto')?.count || 0;

    // Procesar promedios
    const promedioIngreso = promedios.find(p => p._id === 'ingreso')?.promedio || 0;
    const promedioGasto = promedios.find(p => p._id === 'gasto')?.promedio || 0;

    // Procesar extremos
    const [mayorIngreso, mayorGasto] = extremos;

    res.json({
      success: true,
      data: {
        totalTransacciones,
        totalIngresos,
        totalGastos,
        promedioIngreso,
        promedioGasto,
        mayorIngreso,
        mayorGasto
      }
    });
  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};