/* LightMath engine - honest room lighting sizer. Pure logic, no DOM. */
(function (root) {
  'use strict';

  /* Ambient lux targets by room use (maintained illuminance on the floor/work plane). */
  var ROOMS = {
    living:   { label: 'Living room', lux: 150 },
    kitchen:  { label: 'Kitchen', lux: 300 },
    bedroom:  { label: 'Bedroom', lux: 100 },
    bathroom: { label: 'Bathroom', lux: 300 },
    office:   { label: 'Desk / office', lux: 500 },
    dining:   { label: 'Dining room', lux: 200 },
    hallway:  { label: 'Hallway / entry', lux: 100 },
    workshop: { label: 'Workshop / garage', lux: 500 }
  };

  /* Common bulb outputs in lumens. */
  var BULBS = [
    { name: '40W-equiv (450 lm)', lumens: 450 },
    { name: '60W-equiv (800 lm)', lumens: 800 },
    { name: '75W-equiv (1100 lm)', lumens: 1100 },
    { name: '100W-equiv (1600 lm)', lumens: 1600 }
  ];

  /* Extra lux a task zone needs on its surface, beyond ambient. */
  var TASKS = {
    none:      { label: 'No task zone', lux: 0 },
    reading:   { label: 'Reading chair', lux: 300 },
    cooking:   { label: 'Counter / prep', lux: 500 },
    deskwork:  { label: 'Desk work', lux: 500 },
    mirror:    { label: 'Mirror / vanity', lux: 500 },
    finebench: { label: 'Fine bench work', lux: 750 }
  };
  var TASK_AREA_M2 = 1.5; /* a task light covers its zone, not the room */

  function num(x, name, min, max) {
    var v = Number(x);
    if (!isFinite(v) || v < min || v > max) throw new Error(name + ' must be between ' + min + ' and ' + max);
    return v;
  }

  function analyze(input) {
    if (!input || typeof input !== 'object') throw new Error('No input');
    var roomKey = String(input.room || '');
    if (!ROOMS[roomKey]) throw new Error('Pick a room type');
    var lengthM = num(input.lengthM, 'Room length', 1, 30);
    var widthM = num(input.widthM, 'Room width', 1, 30);
    var ceilingM = input.ceilingM == null || input.ceilingM === '' ? 2.5 : num(input.ceilingM, 'Ceiling height', 2, 6);
    var dark = !!input.dark;
    var taskKey = String(input.task || 'none');
    if (!TASKS[taskKey]) throw new Error('Pick a task zone');
    var taskZones = taskKey === 'none' ? 0 : Math.round(num(input.taskCount == null ? 1 : input.taskCount, 'Task zones', 1, 6));
    var currentLm = input.currentLumens == null || input.currentLumens === '' ? null : num(input.currentLumens, 'Current lumens', 0, 200000);

    var area = Math.round(lengthM * widthM * 10) / 10;
    var room = ROOMS[roomKey];

    /* Ceiling factor: light spreads thinner in tall rooms, +10% per 30 cm above 2.7 m. */
    var ceilFactor = ceilingM > 2.7 ? 1 + Math.ceil((ceilingM - 2.7) / 0.3) * 0.10 : 1;
    /* Dark walls and floors absorb instead of bouncing: +25%. */
    var surfFactor = dark ? 1.25 : 1;
    var factor = Math.round(ceilFactor * surfFactor * 100) / 100;

    var ambientLm = Math.ceil(room.lux * area * factor);
    var taskLmEach = Math.ceil(TASKS[taskKey].lux * TASK_AREA_M2);
    var taskLm = taskLmEach * taskZones;
    var totalLm = ambientLm + taskLm;

    /* Best bulb choice for ambient: among options within 20% overshoot,
       prefer the fewest bulbs (nobody wants 7 sockets where 2 do),
       tie-break on waste; if nothing is close, fall back to least waste. */
    var options = BULBS.map(function (b) {
      var count = Math.max(1, Math.ceil(ambientLm / b.lumens));
      var delivered = count * b.lumens;
      return { bulb: b.name, lumensEach: b.lumens, count: count, delivered: delivered, waste: delivered - ambientLm };
    });
    var cap = ambientLm * 0.2;
    var close = options.filter(function (o) { return o.waste <= cap; });
    var pool = close.length ? close : options;
    var best = pool[0];
    pool.forEach(function (o) {
      if (close.length) {
        if (o.count < best.count || (o.count === best.count && o.waste < best.waste)) best = o;
      } else {
        if (o.waste < best.waste || (o.waste === best.waste && o.count < best.count)) best = o;
      }
    });

    var verdictBand, gap = null;
    if (currentLm == null) {
      verdictBand = 'unmeasured';
    } else {
      var ratio = totalLm > 0 ? currentLm / totalLm : 1;
      if (ratio < 0.5) verdictBand = 'cave';
      else if (ratio < 0.85) verdictBand = 'dim';
      else if (ratio <= 1.25) verdictBand = 'balanced';
      else verdictBand = 'over-lit';
      gap = currentLm - totalLm;
    }

    var verdict = room.label + ' of ' + area + ' m2 needs about ' + totalLm.toLocaleString() + ' lumens' +
      (factor > 1 ? ' after a ' + Math.round((factor - 1) * 100) + '% correction for ' +
        (dark && ceilFactor > 1 ? 'dark surfaces and a tall ceiling' : dark ? 'dark surfaces' : 'the tall ceiling') : '') +
      '. That is ' + best.count + ' x ' + best.bulb + ' for ambient light' +
      (taskLm ? ', plus ' + taskZones + ' task light' + (taskZones > 1 ? 's' : '') + ' of ~' + taskLmEach + ' lm (' + TASKS[taskKey].label.toLowerCase() + ')' : '') + '.';
    if (currentLm != null) {
      verdict += ' Your current ' + currentLm.toLocaleString() + ' lm reads "' + verdictBand + '"' +
        (gap < 0 ? ' - short by ' + (-gap).toLocaleString() + ' lm.' : gap > 0 ? ' - ' + gap.toLocaleString() + ' lm above target.' : ' - exactly on target.');
    }

    return {
      room: room.label,
      area: area,
      luxTarget: room.lux,
      ceilFactor: ceilFactor,
      surfFactor: surfFactor,
      factor: factor,
      ambientLm: ambientLm,
      taskLm: taskLm,
      taskLmEach: taskLmEach,
      taskZones: taskZones,
      totalLm: totalLm,
      bulbPick: best,
      currentLumens: currentLm,
      verdictBand: verdictBand,
      gap: gap,
      verdict: verdict
    };
  }

  var api = { analyze: analyze, ROOMS: ROOMS, BULBS: BULBS, TASKS: TASKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LightMathEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
