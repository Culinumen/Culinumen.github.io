/* ==========================================================================
   销量预测系统 · 静态演示
   数据来自 assets/data/forecast.js（由源代码包离线生成），页面不运行 Python。
   ========================================================================== */

(function () {
  'use strict';

  var DATA = window.FORECAST_DATA;
  if (!DATA) { return; }

  var W = 900, H = 380;
  var M = { top: 20, right: 18, bottom: 40, left: 58 };

  var svg = document.getElementById('chart');
  var wrap = document.getElementById('chartWrap');
  var tip = document.getElementById('chartTip');
  var select = document.getElementById('vehicleSelect');
  var statsBox = document.getElementById('stats');
  var tableBox = document.getElementById('forecastTable');
  var hint = document.getElementById('forecastHint');
  var segButtons = Array.prototype.slice.call(document.querySelectorAll('.seg__btn'));

  var state = { vehicle: null, horizon: 3 };
  var geom = null;

  /* ------------------------------------------------------------ 格式化 */
  function fmt(v) {
    if (v >= 10000) { return (v / 10000).toFixed(2) + ' 万'; }
    return Math.round(v).toLocaleString('zh-CN');
  }

  function tickLabel(v, useWan) {
    if (!v) { return '0'; }
    if (useWan) { return (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万'; }
    return Math.round(v).toLocaleString('zh-CN');
  }

  function shortMonth(m) {
    return m.slice(2).replace('-', '/');
  }

  /* -------------------------------------------------------------- KPI */
  var meta = DATA.meta;
  document.getElementById('kpiVehicles').textContent = meta.vehicles;
  document.getElementById('kpiRecords').textContent = meta.records;
  document.getElementById('kpiRange').textContent = meta.start + ' — ' + meta.end;
  document.getElementById('kpiMape').innerHTML = DATA.metrics.model.MAPE + '<small>%</small>';

  /* ---------------------------------------------------------- 车型下拉 */
  var vehicles = DATA.vehicles;
  var defaultVehicle = vehicles.find(function (v) { return v.forecast && v.forecast.length; }) || vehicles[0];

  vehicles.forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = v.name + ' · ' + v.brand + ' · ' + v.energy;
    select.appendChild(opt);
  });
  select.value = defaultVehicle.name;

  /* ------------------------------------------------------------ 评估卡 */
  function buildEval() {
    var box = document.getElementById('evalGrid');
    var metrics = DATA.metrics;
    var groups = [
      { key: 'model', title: '梯度提升树', tag: 'GBR · 220 trees', cls: 'eval-card--model' },
      { key: 'baseline_lag_1', title: 'lag-1 基线', tag: '上月销量', cls: '' },
      { key: 'baseline_rolling_3', title: '3 月滚动均值', tag: 'baseline', cls: '' }
    ];
    var keys = ['MAE', 'RMSE', 'MAPE', 'sMAPE'];
    var max = {};
    keys.forEach(function (k) {
      max[k] = Math.max.apply(null, groups.map(function (g) { return metrics[g.key][k]; }));
    });

    box.innerHTML = groups.map(function (g) {
      var rows = keys.map(function (k) {
        var value = metrics[g.key][k];
        var pct = max[k] > 0 ? (value / max[k]) * 100 : 0;
        var unit = (k === 'MAPE' || k === 'sMAPE') ? '%' : '';
        return '<div class="erow">' +
          '<span class="erow__k">' + k + '</span>' +
          '<span class="erow__track"><span class="erow__fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
          '<span class="erow__v">' + value.toLocaleString('zh-CN') + unit + '</span>' +
          '</div>';
      }).join('');
      return '<div class="eval-card ' + g.cls + '">' +
        '<div class="eval-card__head"><span class="eval-card__title">' + g.title + '</span>' +
        '<span class="eval-card__tag">' + g.tag + '</span></div>' + rows + '</div>';
    }).join('');

    document.getElementById('evalNote').textContent =
      '验证区间 ' + metrics.validation_months[0] + ' 至 ' + metrics.validation_months[metrics.validation_months.length - 1] +
      '，共 ' + metrics.sample_count + ' 个样本。梯度提升树相对 3 月滚动均值基线更好，但仍略逊于 lag-1 基线（MAE ' +
      metrics.model.MAE.toLocaleString('zh-CN') + ' 对 ' + metrics.baseline_lag_1.MAE.toLocaleString('zh-CN') +
      '）。这说明「上一个月销量」本身已经是很强的预测，模型的价值要靠在更长周期、更多车型上的稳定性来证明，而不是只比一个基线。';
  }

  /* -------------------------------------------------------------- 绘图 */
  function renderChart(vehicle, horizon) {
    var history = vehicle.history;
    var forecastAll = vehicle.forecast || [];
    var forecast = forecastAll.slice(0, horizon);

    var labels = history.map(function (p) { return p[0]; }).concat(forecast.map(function (p) { return p[0]; }));
    var values = history.map(function (p) { return p[1]; });
    var fcValues = forecast.map(function (p) { return p[1]; });

    var n = labels.length;
    var all = values.concat(fcValues);
    var maxV = Math.max.apply(null, all) * 1.15 || 1;
    var plotW = W - M.left - M.right;
    var plotH = H - M.top - M.bottom;

    function X(i) { return M.left + (n <= 1 ? 0 : (plotW * i) / (n - 1)); }
    function Y(v) { return M.top + plotH * (1 - v / maxV); }

    var parts = [];

    // 网格与 y 轴刻度
    for (var g = 0; g <= 4; g += 1) {
      var gy = M.top + (plotH * g) / 4;
      var gv = maxV * (1 - g / 4);
      parts.push('<line class="c-grid" x1="' + M.left + '" y1="' + gy + '" x2="' + (W - M.right) + '" y2="' + gy + '"/>');
      parts.push('<text class="c-tick" x="' + (M.left - 10) + '" y="' + (gy + 3.5) + '" text-anchor="end">' + tickLabel(gv, maxV >= 20000) + '</text>');
    }

    // x 轴
    parts.push('<line class="c-axis" x1="' + M.left + '" y1="' + (H - M.bottom) + '" x2="' + (W - M.right) + '" y2="' + (H - M.bottom) + '"/>');
    var step = Math.max(1, Math.ceil(n / 8));
    labels.forEach(function (label, i) {
      if (i % step === 0 || i === n - 1) {
        parts.push('<text class="c-tick" x="' + X(i) + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle">' + shortMonth(label) + '</text>');
      }
    });

    // 历史面积与折线
    var histPath = '';
    values.forEach(function (v, i) {
      histPath += (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
    });

    if (values.length > 1) {
      parts.push('<path class="c-area" d="' + histPath + 'L' + X(values.length - 1).toFixed(1) + ' ' + (H - M.bottom) + ' L' + X(0).toFixed(1) + ' ' + (H - M.bottom) + ' Z"/>');
    }
    parts.push('<path class="c-line" d="' + histPath + '"/>');

    // 预测段
    var divisionX = null;
    if (fcValues.length) {
      var fcPath = 'M' + X(values.length - 1).toFixed(1) + ' ' + Y(values[values.length - 1]).toFixed(1) + ' ';
      fcValues.forEach(function (v, k) {
        fcPath += 'L' + X(values.length + k).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
      });
      parts.push('<path class="c-fc-line" d="' + fcPath + '"/>');
      fcValues.forEach(function (v, k) {
        parts.push('<circle class="c-fc-dot" cx="' + X(values.length + k).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.2"/>');
      });

      divisionX = X(values.length - 1);
      parts.push('<line class="c-divider" x1="' + divisionX + '" y1="' + M.top + '" x2="' + divisionX + '" y2="' + (H - M.bottom) + '"/>');
      parts.push('<text class="c-divider-label" x="' + (divisionX + 30) + '" y="' + (M.top + 12) + '">预测</text>');
    }

    // 图例
    parts.push('<g><line x1="' + (M.left + 2) + '" y1="' + (M.top - 4) + '" x2="' + (M.left + 22) + '" y2="' + (M.top - 4) + '" style="stroke:var(--accent-2);stroke-width:2"/>' +
      '<text class="c-legend" x="' + (M.left + 28) + '" y="' + (M.top - 1) + '">历史销量</text>');
    if (fcValues.length) {
      parts.push('<line x1="' + (M.left + 88) + '" y1="' + (M.top - 4) + '" x2="' + (M.left + 108) + '" y2="' + (M.top - 4) + '" style="stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4"/>' +
        '<text class="c-legend" x="' + (M.left + 114) + '" y="' + (M.top - 1) + '">模型预测</text>');
    }
    parts.push('</g>');

    // 悬停层
    parts.push('<g id="hoverLayer"></g>');
    parts.push('<rect x="' + M.left + '" y="' + M.top + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" id="hoverArea"/>');

    svg.innerHTML = parts.join('');
    svg.setAttribute('aria-label',
      vehicle.name + ' 月度销量：' + labels[0] + ' 至 ' + labels[n - 1] + '，共 ' + n + ' 个数据点' +
      (fcValues.length ? '，其中 ' + fcValues.length + ' 个月为模型预测' : ''));

    geom = {
      n: n, X: X, Y: Y, labels: labels,
      values: values.concat(fcValues),
      kinds: values.map(function () { return '历史'; }).concat(fcValues.map(function () { return '预测'; })),
      histCount: values.length
    };

    bindHover();
  }

  /* ------------------------------------------------------------ 悬停 */
  function bindHover() {
    var area = document.getElementById('hoverArea');
    if (!area) { return; }

    area.addEventListener('pointermove', function (event) {
      if (!geom) { return; }
      var rect = svg.getBoundingClientRect();
      var vx = ((event.clientX - rect.left) / rect.width) * W;
      var plotW = W - M.left - M.right;
      var ratio = (vx - M.left) / plotW;
      var idx = Math.round(ratio * (geom.n - 1));
      idx = Math.max(0, Math.min(geom.n - 1, idx));

      var cx = geom.X(idx);
      var cy = geom.Y(geom.values[idx]);
      var layer = document.getElementById('hoverLayer');
      layer.innerHTML = '<line x1="' + cx + '" y1="' + M.top + '" x2="' + cx + '" y2="' + (H - M.bottom) + '" style="stroke:var(--line-strong);stroke-dasharray:3 3"/>' +
        '<circle class="c-hover-dot" cx="' + cx + '" cy="' + cy + '" r="4.5"/>';

      var wrapRect = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = '<small>' + geom.labels[idx] + ' · ' + geom.kinds[idx] + '</small><b>' + fmt(geom.values[idx]) + '</b>';
      tip.style.left = ((cx / W) * rect.width + (rect.left - wrapRect.left)) + 'px';
      tip.style.top = ((cy / H) * rect.height + (rect.top - wrapRect.top)) + 'px';
    });

    area.addEventListener('pointerleave', function () {
      var layer = document.getElementById('hoverLayer');
      if (layer) { layer.innerHTML = ''; }
      tip.hidden = true;
    });
  }

  /* ------------------------------------------------------------ 统计 */
  function renderStats(vehicle, forecast) {
    var history = vehicle.history;
    var last = history[history.length - 1];
    var recent = history.slice(-6);
    var avg = recent.reduce(function (s, p) { return s + p[1]; }, 0) / recent.length;
    var peak = history.reduce(function (a, b) { return b[1] > a[1] ? b : a; });

    var items = [
      { label: '最新月销量', value: fmt(last[1]).replace(' 万', ''), unit: fmt(last[1]).indexOf('万') > -1 ? '万' : '', note: last[0] },
      { label: '近 6 月均值', value: fmt(avg).replace(' 万', ''), unit: fmt(avg).indexOf('万') > -1 ? '万' : '', note: recent[0][0] + ' 起' },
      { label: '历史峰值', value: fmt(peak[1]).replace(' 万', ''), unit: fmt(peak[1]).indexOf('万') > -1 ? '万' : '', note: peak[0] },
      {
        label: forecast.length ? '预测末月' : '样本点',
        value: forecast.length ? fmt(forecast[forecast.length - 1][1]).replace(' 万', '') : history.length,
        unit: forecast.length ? (fmt(forecast[forecast.length - 1][1]).indexOf('万') > -1 ? '万' : '') : '个',
        note: forecast.length ? forecast[forecast.length - 1][0] : vehicle.energy + ' · ' + vehicle.level
      }
    ];

    statsBox.innerHTML = items.map(function (it) {
      return '<div class="dstat"><div class="dstat__label">' + it.label + '</div>' +
        '<div class="dstat__value">' + it.value + (it.unit ? '<small>' + it.unit + '</small>' : '') + '</div>' +
        '<div class="demo-hint" style="margin-top:2px">' + it.note + '</div></div>';
    }).join('');
  }

  function renderTable(vehicle, forecast, horizon) {
    if (!forecast.length) {
      tableBox.innerHTML = '';
      hint.textContent = '该车型未包含在源代码包保存的预测结果中。完整预测需要本地启动 FastAPI 后端后调用 /api/predict；仓库里包含训练好的模型与递归预测代码。';
      return;
    }

    var lastActual = vehicle.history[vehicle.history.length - 1][1];
    var rows = forecast.map(function (p) {
      var delta = ((p[1] - lastActual) / lastActual) * 100;
      return '<tr><td>' + p[0] + '</td><td class="num">' + p[1].toLocaleString('zh-CN') + '</td>' +
        '<td class="num">' + (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%</td></tr>';
    }).join('');

    tableBox.innerHTML = '<table><thead><tr><th>预测月份</th><th style="text-align:right">预测销量（辆）</th>' +
      '<th style="text-align:right">相对 ' + vehicle.history[vehicle.history.length - 1][0] + '</th></tr></thead><tbody>' + rows + '</tbody></table>';

    hint.textContent = vehicle.forecast.length > horizon
      ? '当前显示 ' + horizon + ' 个月（共保存 ' + vehicle.forecast.length + ' 个月）。'
      : '预测为源代码包中已保存的模型输出（' + vehicle.name + '，' + forecast.length + ' 个月）。递归多步预测会累积误差，越往后参考价值越低。';
  }

  /* ------------------------------------------------------------ 更新 */
  function update() {
    var vehicle = vehicles.find(function (v) { return v.name === state.vehicle; }) || defaultVehicle;
    var forecast = (vehicle.forecast || []).slice(0, state.horizon);

    var hasForecast = vehicle.forecast && vehicle.forecast.length;
    segButtons.forEach(function (btn) {
      btn.disabled = !hasForecast;
      btn.classList.toggle('is-active', Number(btn.getAttribute('data-horizon')) === state.horizon && !!hasForecast);
      btn.setAttribute('aria-pressed', btn.classList.contains('is-active') ? 'true' : 'false');
    });

    renderChart(vehicle, state.horizon);
    renderStats(vehicle, forecast);
    renderTable(vehicle, forecast, state.horizon);

    tip.hidden = true;
    if (!hasForecast) {
      hint.textContent = '该车型未包含在源代码包保存的预测结果中。完整预测需要本地启动 FastAPI 后端后调用 /api/predict；仓库里包含训练好的模型与递归预测代码。';
    }
  }

  /* ------------------------------------------------------------ 事件 */
  select.addEventListener('change', function () {
    state.vehicle = select.value;
    update();
  });

  segButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.horizon = Number(btn.getAttribute('data-horizon'));
      update();
    });
  });

  state.vehicle = defaultVehicle.name;
  buildEval();
  update();
})();
