// Pure puzzle logic for Towers (a.k.a. Skyscrapers). No DOM access here.
// Values are 1..n; 0 means empty / no clue. Candidate sets are bitmasks where bit v = value v.
(function (root) {
  function fullMask(n) {
    return ((1 << (n + 1)) - 1) & ~1;
  }

  function maskValues(mask) {
    const out = [];
    for (let v = 1; mask >> v; v++) if (mask & (1 << v)) out.push(v);
    return out;
  }

  // Number of towers visible looking along `line` from index 0.
  function visible(line) {
    let max = 0, count = 0;
    for (const v of line) if (v > max) { max = v; count++; }
    return count;
  }

  // Enumerate every permutation of 1..n that fits `domains` (one bitmask per cell)
  // and the clues at both ends of the line. Returns the union of values seen per
  // cell, and whether any permutation exists at all.
  function lineOptions(n, domains, startClue, endClue) {
    const union = new Array(n).fill(0);

    if (!startClue && !endClue) {
      // No clues: only the "each value once" rule applies.
      let placed = 0, ok = true;
      for (const d of domains) {
        if (d && (d & (d - 1)) === 0) {
          if (placed & d) ok = false;
          placed |= d;
        }
      }
      for (let i = 0; i < n; i++) {
        const d = domains[i];
        const single = d && (d & (d - 1)) === 0;
        union[i] = single ? d : d & ~placed;
        if (!union[i]) ok = false;
      }
      return { union, ok };
    }

    const cur = new Array(n);
    let used = 0, found = false;

    function rec(i, max, count) {
      if (startClue) {
        if (count > startClue) return;
        // Even if every remaining tower were a new maximum we couldn't reach the clue.
        if (count + Math.min(n - i, n - max) < startClue) return;
      }
      if (i === n) {
        if (startClue && count !== startClue) return;
        if (endClue) {
          let m = 0, c = 0;
          for (let k = n - 1; k >= 0; k--) if (cur[k] > m) { m = cur[k]; c++; }
          if (c !== endClue) return;
        }
        for (let k = 0; k < n; k++) union[k] |= 1 << cur[k];
        found = true;
        return;
      }
      let d = domains[i] & ~used;
      while (d) {
        const b = d & -d;
        d ^= b;
        const v = 31 - Math.clz32(b);
        cur[i] = v;
        used |= b;
        rec(i + 1, v > max ? v : max, v > max ? count + 1 : count);
        used ^= b;
      }
    }

    rec(0, 0, 0);
    return { union, ok: found };
  }

  // Candidates for every cell, given the placed values only (grid[r][c], 0 = empty).
  // A value is a candidate if it fits some valid completion of its row AND some valid
  // completion of its column, each considered on its own.
  // Returns { cand: number[][] bitmasks, badLines: [{kind:'row'|'col', index}] }.
  function computeCandidates(n, clues, grid) {
    const full = fullMask(n);
    const dom = grid.map(row => row.map(v => (v ? 1 << v : full)));
    const rowU = [], colU = [], badLines = [];

    for (let r = 0; r < n; r++) {
      const res = lineOptions(n, dom[r], clues.left[r], clues.right[r]);
      rowU.push(res.union);
      if (!res.ok) badLines.push({ kind: 'row', index: r });
    }
    for (let c = 0; c < n; c++) {
      const col = dom.map(row => row[c]);
      const res = lineOptions(n, col, clues.top[c], clues.bottom[c]);
      colU.push(res.union);
      if (!res.ok) badLines.push({ kind: 'col', index: c });
    }

    const cand = [];
    for (let r = 0; r < n; r++) {
      cand.push([]);
      for (let c = 0; c < n; c++) cand[r].push(rowU[r][c] & colU[c][r]);
    }
    return { cand, badLines };
  }

  // Cells that duplicate a value elsewhere in their row or column.
  function conflicts(n, grid) {
    const bad = grid.map(row => row.map(() => false));
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          if (grid[i][a] && grid[i][a] === grid[i][b]) bad[i][a] = bad[i][b] = true;
          if (grid[a][i] && grid[a][i] === grid[b][i]) bad[a][i] = bad[b][i] = true;
        }
      }
    }
    return bad;
  }

  // Line of values as seen from a clue position.
  function lineFrom(n, grid, side, i) {
    const line = [];
    for (let k = 0; k < n; k++) {
      if (side === 'top') line.push(grid[k][i]);
      else if (side === 'bottom') line.push(grid[n - 1 - k][i]);
      else if (side === 'left') line.push(grid[i][k]);
      else line.push(grid[i][n - 1 - k]);
    }
    return line;
  }

  // 'ok' / 'bad' once the line is full, otherwise null.
  function clueStatus(n, clues, grid, side, i) {
    const clue = clues[side][i];
    if (!clue) return null;
    const line = lineFrom(n, grid, side, i);
    if (line.some(v => !v)) return null;
    return visible(line) === clue ? 'ok' : 'bad';
  }

  const api = { fullMask, maskValues, visible, lineOptions, computeCandidates, conflicts, lineFrom, clueStatus };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Towers = api;
})(this);
