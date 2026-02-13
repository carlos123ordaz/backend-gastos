const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

// @desc    Obtener resumen del dashboard
// dashboardController.js - reemplazar getResumen completo

exports.getResumen = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    // Construir filtro de fecha AJUSTADO A UTC
    // Desde Perú (UTC-5), si el usuario envía "2025-02-12",
    // queremos incluir todo ese día en hora local.
    // Inicio del día local = 2025-02-12T00:00:00-05:00 = 2025-02-12T05:00:00Z
    // Fin del día local = 2025-02-12T23:59:59-05:00 = 2025-02-13T04:59:59Z
    const filter = {};
    if (fechaInicio || fechaFin) {
      filter.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio + 'T00:00:00-05:00');
        filter.fecha.$gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin + 'T23:59:59.999-05:00');
        filter.fecha.$lte = fin;
      }
    }

    // Ejecutar consultas en paralelo
    const [
      settings,
      totalesGlobal,       // SIN filtro de fecha — acumulado total
      totalesPeriodo,      // CON filtro de fecha — solo período seleccionado
      gastosPorCategoria,
      transaccionesPorMes
    ] = await Promise.all([
      Settings.findOne().lean(),

      // TOTALES GLOBALES (todos los meses, sin filtro)
      Transaction.aggregate([
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$monto' }
          }
        }
      ]),

      // TOTALES DEL PERÍODO FILTRADO
      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$tipo',
            total: { $sum: '$monto' }
          }
        }
      ]),

      // Gastos por categoría (del período)
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

    let finalSettings = settings;
    if (!settings) {
      finalSettings = await Settings.create({ montoInicial: 0 });
    }

    // Totales GLOBALES (para balance real y tarjetas principales)
    const totalIngresosGlobal = totalesGlobal.find(t => t._id === 'ingreso')?.total || 0;
    const totalGastosGlobal = totalesGlobal.find(t => t._id === 'gasto')?.total || 0;
    const balance = finalSettings.montoInicial + totalIngresosGlobal - totalGastosGlobal;

    // Totales del PERÍODO (para contexto del filtro)
    const totalIngresosPeriodo = totalesPeriodo.find(t => t._id === 'ingreso')?.total || 0;
    const totalGastosPeriodo = totalesPeriodo.find(t => t._id === 'gasto')?.total || 0;

    res.json({
      success: true,
      data: {
        montoInicial: finalSettings.montoInicial,
        // Globales
        totalIngresos: totalIngresosGlobal,
        totalGastos: totalGastosGlobal,
        balance,
        // Del período
        totalIngresosPeriodo,
        totalGastosPeriodo,
        // Charts
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