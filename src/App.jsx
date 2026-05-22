import { useEffect, useMemo, useState } from 'react';

const STORAGE_SHIPS = 'xwing-squad-ships';
const STORAGE_SQUAD = 'xwing-squad-data';
const STORAGE_PRESETS = 'xwing-squad-presets';
const FACTIONS = ['All', 'Rebel', 'Imperial', 'Scum'];
const POINT_LIMIT_DEFAULT = 200;
const MAX_SQUAD_SIZE = 6;

const defaultShips = [
  { id: 'xwing-1', name: 'X-Wing', pilot: 'Rookie Pilot', faction: 'Rebel', points: 24 },
  { id: 'tiefighter-1', name: 'TIE Fighter', pilot: 'Mauler Mithel', faction: 'Imperial', points: 22 },
  { id: 'ywings-1', name: 'Y-Wing', pilot: 'Gold Squadron Pilot', faction: 'Rebel', points: 24 },
  { id: 'tiex1-1', name: 'TIE Advanced', pilot: 'Darth Vader', faction: 'Imperial', points: 29 },
  { id: 'awing-1', name: 'A-Wing', pilot: 'Green Squadron Pilot', faction: 'Rebel', points: 21 },
  { id: 'hwk-1', name: 'HWK-290', pilot: 'Jan Ors', faction: 'Rebel', points: 24 }
];

function loadSaved(key, fallback) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function App() {
  const [ships, setShips] = useState(defaultShips);
  const [squad, setSquad] = useState([]);
  const [form, setForm] = useState({ name: '', pilot: '', faction: 'Rebel', points: '' });
  const [editingShipId, setEditingShipId] = useState(null);
  const [importJson, setImportJson] = useState('');
  const [shipFilter, setShipFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState([]);
  const [squadPointLimit, setSquadPointLimit] = useState(POINT_LIMIT_DEFAULT);
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    const savedShips = loadSaved(STORAGE_SHIPS, null);
    const savedSquad = loadSaved(STORAGE_SQUAD, null);
    const savedPresets = loadSaved(STORAGE_PRESETS, []);
    if (savedShips) setShips(savedShips);
    if (savedSquad) setSquad(savedSquad);
    if (savedPresets) setPresets(savedPresets);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_SHIPS, JSON.stringify(ships));
    window.localStorage.setItem(STORAGE_SQUAD, JSON.stringify(squad));
  }, [ships, squad]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
  }, [presets]);

  const totalPoints = useMemo(
    () => squad.reduce((sum, item) => sum + item.points, 0),
    [squad]
  );

  const filteredShips = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return ships.filter((ship) => {
      const matchesFaction = shipFilter === 'All' || ship.faction === shipFilter;
      const matchesQuery =
        !query || ship.name.toLowerCase().includes(query) || ship.pilot.toLowerCase().includes(query);
      return matchesFaction && matchesQuery;
    });
  }, [ships, shipFilter, searchQuery]);

  const squadTotals = useMemo(() => {
    const summary = {
      Rebel: { count: 0, points: 0 },
      Imperial: { count: 0, points: 0 },
      Scum: { count: 0, points: 0 }
    };
    squad.forEach((item) => {
      if (summary[item.faction]) {
        summary[item.faction].count += 1;
        summary[item.faction].points += item.points;
      }
    });
    return summary;
  }, [squad]);

  const validationWarnings = useMemo(() => {
    const warnings = [];
    if (squad.length > MAX_SQUAD_SIZE) {
      warnings.push(`Squad has more than ${MAX_SQUAD_SIZE} ships.`);
    }
    if (totalPoints > squadPointLimit) {
      warnings.push(`Squad exceeds the ${squadPointLimit}-point limit.`);
    }
    const duplicates = squad.reduce((acc, item) => {
      const key = `${item.name}::${item.pilot}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    Object.entries(duplicates).forEach(([key, count]) => {
      if (count > 1) {
        warnings.push(`Duplicate squad member detected: ${key.split('::')[0]} (${key.split('::')[1]}).`);
      }
    });
    return warnings;
  }, [squad, totalPoints, squadPointLimit]);

  const handleInput = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const resetForm = () => {
    setForm({ name: '', pilot: '', faction: 'Rebel', points: '' });
    setEditingShipId(null);
  };

  const saveShip = () => {
    const points = Number(form.points);
    if (!form.name.trim() || !form.pilot.trim() || !form.faction.trim() || Number.isNaN(points)) {
      window.alert('Complete ship name, pilot, faction, and points before saving.');
      return;
    }

    if (editingShipId) {
      setShips((current) =>
        current.map((ship) =>
          ship.id === editingShipId
            ? { ...ship, name: form.name, pilot: form.pilot, faction: form.faction, points }
            : ship
        )
      );
    } else {
      const id = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      setShips((current) => [...current, { id, name: form.name, pilot: form.pilot, faction: form.faction, points }]);
    }

    resetForm();
  };

  const editShip = (ship) => {
    setEditingShipId(ship.id);
    setForm({ name: ship.name, pilot: ship.pilot, faction: ship.faction, points: String(ship.points) });
  };

  const removeShip = (shipId) => {
    if (!window.confirm('Remove this ship from the database?')) return;
    setShips((current) => current.filter((ship) => ship.id !== shipId));
    setSquad((current) => current.filter((member) => member.shipId !== shipId));
  };

  const addToSquad = (ship) => {
    const squadItem = {
      id: `${ship.id}-${Date.now()}`,
      shipId: ship.id,
      name: ship.name,
      pilot: ship.pilot,
      faction: ship.faction,
      points: ship.points
    };
    setSquad((current) => [...current, squadItem]);
  };

  const removeFromSquad = (memberId) => {
    setSquad((current) => current.filter((item) => item.id !== memberId));
  };

  const updateShipPoints = (shipId, points) => {
    const value = Number(points);
    if (Number.isNaN(value)) return;
    setShips((current) => current.map((ship) => (ship.id === shipId ? { ...ship, points: value } : ship)));
    setSquad((current) => current.map((item) => (item.shipId === shipId ? { ...item, points: value } : item)));
  };

  const moveSquadItem = (fromId, toId) => {
    const current = [...squad];
    const fromIndex = current.findIndex((item) => item.id === fromId);
    const toIndex = current.findIndex((item) => item.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setSquad(current);
  };

  const onDragStart = (id) => {
    setDraggingId(id);
  };

  const onDrop = (id) => {
    if (!draggingId || draggingId === id) return;
    moveSquadItem(draggingId, id);
    setDraggingId(null);
  };

  const savePreset = () => {
    if (!presetName.trim()) {
      window.alert('Enter a preset name before saving.');
      return;
    }
    if (squad.length === 0) {
      window.alert('Build a squad before saving a preset.');
      return;
    }
    const newPreset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      squad: squad.map((item) => ({ ...item })),
      createdAt: Date.now()
    };
    setPresets((current) => [newPreset, ...current]);
    setPresetName('');
  };

  const loadPreset = (preset) => {
    if (!window.confirm(`Load preset "${preset.name}" and replace the current squad?`)) return;
    setSquad(
      preset.squad.map((item, index) => ({
        ...item,
        id: `${item.shipId}-${Date.now()}-${index}`
      }))
    );
  };

  const removePreset = (presetId) => {
    if (!window.confirm('Delete this preset?')) return;
    setPresets((current) => current.filter((item) => item.id !== presetId));
  };

  const exportData = () => {
    const payload = JSON.stringify({ ships, squad, presets }, null, 2);
    navigator.clipboard.writeText(payload).then(
      () => window.alert('Squad export copied to clipboard.'),
      () => window.alert('Could not copy export to clipboard. Use manual copy instead.')
    );
  };

  const downloadData = () => {
    const payload = JSON.stringify({ ships, squad, presets }, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const fileName = `xwing-squad-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      window.alert('Please select a JSON file.');
      event.target.value = '';
      return;
    }
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.ships) && Array.isArray(parsed.squad)) {
        setShips(parsed.ships);
        setSquad(parsed.squad);
        setPresets(Array.isArray(parsed.presets) ? parsed.presets : []);
        setImportJson('');
        window.alert('Imported ships, squad, and presets from file successfully.');
      } else {
        throw new Error('Invalid file format');
      }
    } catch {
      window.alert('Import failed. Select a valid X-Wing squad JSON file.');
    } finally {
      event.target.value = '';
    }
  };

  const importData = () => {
    if (!importJson.trim()) {
      window.alert('Paste valid JSON to import.');
      return;
    }
    try {
      const parsed = JSON.parse(importJson);
      if (Array.isArray(parsed.ships) && Array.isArray(parsed.squad)) {
        setShips(parsed.ships);
        setSquad(parsed.squad);
        setPresets(Array.isArray(parsed.presets) ? parsed.presets : []);
        setImportJson('');
        window.alert('Imported ships, squad, and presets successfully.');
      } else {
        throw new Error('Invalid import format');
      }
    } catch {
      window.alert('Import failed. Use valid JSON with ships and squad arrays.');
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>X-Wing Squad Builder</h1>
        <p>Manage ships, update squad points, add custom pilots, and save squad presets.</p>
      </header>

      <main>
        <section className="panel">
          <h2>Ship Database</h2>
          <div className="panel-top">
            <div className="filter-actions">
              <label>
                Faction filter
                <select value={shipFilter} onChange={(e) => setShipFilter(e.target.value)}>
                  {FACTIONS.map((faction) => (
                    <option key={faction}>{faction}</option>
                  ))}
                </select>
              </label>
              <label>
                Search ships
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ship or pilot"
                />
              </label>
            </div>
            <div className="badge-row">
              <span className="badge">Showing {filteredShips.length} ships</span>
              <span className="badge">All ships: {ships.length}</span>
            </div>
          </div>

          <div className="grid">
            <div className="panel-block">
              <h3>{editingShipId ? 'Edit Ship' : 'Add New Ship'}</h3>
              <label>
                Ship name
                <input value={form.name} onChange={(e) => handleInput('name', e.target.value)} />
              </label>
              <label>
                Pilot name
                <input value={form.pilot} onChange={(e) => handleInput('pilot', e.target.value)} />
              </label>
              <label>
                Faction
                <select value={form.faction} onChange={(e) => handleInput('faction', e.target.value)}>
                  <option>Rebel</option>
                  <option>Imperial</option>
                  <option>Scum</option>
                </select>
              </label>
              <label>
                Points
                <input type="number" min="0" value={form.points} onChange={(e) => handleInput('points', e.target.value)} />
              </label>
              <div className="button-row">
                <button onClick={saveShip}>{editingShipId ? 'Save changes' : 'Add ship'}</button>
                {editingShipId && <button className="secondary" onClick={resetForm}>Cancel</button>}
              </div>
            </div>

            <div className="panel-block ship-table-block">
              <h3>Available ships</h3>
              <div className="ship-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Pilot</th>
                      <th>Faction</th>
                      <th>Points</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShips.map((ship) => (
                      <tr key={ship.id}>
                        <td>{ship.name}</td>
                        <td>{ship.pilot}</td>
                        <td>
                          <span className={`faction-tag faction-${ship.faction.toLowerCase()}`}>
                            {ship.faction}
                          </span>
                        </td>
                        <td>
                          <input
                            className="inline-input"
                            type="number"
                            value={ship.points}
                            onChange={(e) => updateShipPoints(ship.id, e.target.value)}
                          />
                        </td>
                        <td className="actions">
                          <button onClick={() => addToSquad(ship)}>Add</button>
                          <button className="secondary" onClick={() => editShip(ship)}>Edit</button>
                          <button className="danger" onClick={() => removeShip(ship.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Squad Builder</h2>
          <div className="summary-row">
            <div>
              <strong>Squad size:</strong> {squad.length}
            </div>
            <div>
              <strong>Total points:</strong> {totalPoints}
            </div>
            <div>
              <label>
                Points limit
                <input
                  className="limit-input"
                  type="number"
                  min="0"
                  value={squadPointLimit}
                  onChange={(e) => setSquadPointLimit(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
          <div className="faction-summary">
            {FACTIONS.filter((faction) => faction !== 'All').map((faction) => (
              <span key={faction} className={`badge faction-${faction.toLowerCase()}`}>
                {faction}: {squadTotals[faction].count} ships / {squadTotals[faction].points} pts
              </span>
            ))}
          </div>
          {validationWarnings.length > 0 && (
            <div className="validation-panel">
              <h4>Validation warnings</h4>
              <ul>
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="section-note">Drag squad rows to reorder your fleet.</div>

          <div className="squad-list">
            {squad.length === 0 ? (
              <p>No squad members yet. Add ships from the database above.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pilot</th>
                    <th>Faction</th>
                    <th>Points</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {squad.map((member) => (
                    <tr
                      key={member.id}
                      draggable
                      onDragStart={() => onDragStart(member.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onDrop(member.id)}
                      className={member.id === draggingId ? 'dragging' : ''}
                    >
                      <td>{member.name}</td>
                      <td>{member.pilot}</td>
                      <td>
                        <span className={`faction-tag faction-${member.faction.toLowerCase()}`}>
                          {member.faction}
                        </span>
                      </td>
                      <td>{member.points}</td>
                      <td>
                        <button className="danger" onClick={() => removeFromSquad(member.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Squad Presets</h2>
          <div className="panel-block">
            <label>
              Preset name
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="My Rebel fleet" />
            </label>
            <div className="button-row">
              <button onClick={savePreset}>Save current squad as preset</button>
            </div>
          </div>
          {presets.length === 0 ? (
            <p>No saved presets yet. Save your current squad to reuse it later.</p>
          ) : (
            <div className="preset-grid">
              {presets.map((preset) => (
                <div className="preset-card" key={preset.id}>
                  <h4>{preset.name}</h4>
                  <div className="preset-meta">{new Date(preset.createdAt).toLocaleString()}</div>
                  <div className="preset-actions">
                    <button onClick={() => loadPreset(preset)}>Load</button>
                    <button className="secondary" onClick={() => removePreset(preset.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Export / Import</h2>
          <p>Copy, download, or upload squad JSON to save or restore your custom data.</p>
          <div className="button-row">
            <button onClick={exportData}>Copy export to clipboard</button>
            <button onClick={downloadData}>Download export file</button>
            <label className="file-button">
              <span>Upload squad file</span>
              <input type="file" accept=".json,application/json" onChange={handleFileUpload} />
            </label>
          </div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste exported JSON here to import"
            rows={6}
          />
          <button onClick={importData}>Import squad JSON</button>
        </section>
      </main>
    </div>
  );
}

export default App;
