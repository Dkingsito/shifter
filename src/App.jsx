import React, { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  ShieldCheck, Trash2, UserPlus, FileText, Menu, AlertTriangle, X, 
  Image as ImageIcon, FileIcon, Eraser, Settings, Calendar, Edit3, 
  User, Check, Moon, Gift, Briefcase, MousePointer2, CheckSquare, 
  PlusCircle, FolderPlus, FolderOpen, ChevronDown, MoreVertical, 
  Thermometer, Share2, Clock, AlertCircle, Download, HelpCircle,
  UploadCloud, DownloadCloud
} from 'lucide-react';

// --- CONSTANTES ---
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FIXED_HOLIDAYS = ['1/0', '6/0', '1/4', '15/7', '12/9', '1/10', '6/11', '8/11', '25/11'];
const CUSTOM_COLORS = [
  { label: 'Rosa', class: 'bg-pink-100 text-pink-800 border-pink-200' },
  { label: 'Morado', class: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { label: 'Cian', class: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { label: 'Lima', class: 'bg-lime-100 text-lime-800 border-lime-200' },
  { label: 'Gris Oscuro', class: 'bg-gray-700 text-white border-gray-600' },
  { label: 'Amarillo', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
];

const INITIAL_STAFF = [
  { id: 1, name: 'Vigilante 1', hoursContract: 162, role: 'VS' },
  { id: 2, name: 'Vigilante 2', hoursContract: 162, role: 'VS' },
];

// --- UTILIDADES ---
const formatTime = (h) => `${h.toString().padStart(2, '0')}:00`;

const timeToDecimal = (t) => { 
  if (!t) return 0; 
  // Protección extra por si llega un número en vez de string
  if (typeof t === 'number') return t;
  const [h, m] = t.split(':').map(Number); 
  return h + (m / 60); 
};

const decimalToTime = (decimal) => {
    let h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    if (h >= 24) h -= 24; 
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const loadState = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === "undefined" || saved === "null") return fallback;
    return JSON.parse(saved);
  } catch (e) { 
    return fallback; 
  }
};

const calculateNightHoursForShift = (startHourDecimal, duration) => {
  let nightHours = 0;
  const shiftStart = startHourDecimal;
  const shiftEnd = startHourDecimal + duration;
  const nightIntervals = [{ start: 0, end: 6 }, { start: 22, end: 30 }, { start: 46, end: 54 }];

  nightIntervals.forEach(interval => {
      const overlapStart = Math.max(shiftStart, interval.start);
      const overlapEnd = Math.min(shiftEnd, interval.end);
      if (overlapEnd > overlapStart) nightHours += (overlapEnd - overlapStart);
  });
  return parseFloat(nightHours.toFixed(2));
};

const checkRestViolation = (prevShift, currentShift, mode, shiftConfig, customShifts) => {
    if (!prevShift || !currentShift) return false;
    
    const getShiftInfo = (code) => {
        if (customShifts && customShifts[code]) {
            const startStr = customShifts[code].startTime || "00:00";
            return { start: timeToDecimal(startStr), duration: customShifts[code].hours };
        }
        if (shiftConfig && shiftConfig[mode] && shiftConfig[mode].types[code]) {
            return { 
                start: shiftConfig[mode].types[code].start, 
                duration: shiftConfig[mode].types[code].hours 
            };
        }
        return null;
    };

    const prev = getShiftInfo(prevShift);
    const curr = getShiftInfo(currentShift);

    if (!prev || !curr) return false;

    const prevEndAbs = prev.start + prev.duration;
    const currStartAbs = 24 + curr.start;

    const restHours = currStartAbs - prevEndAbs;
    
    return restHours < 11.95;
};

// --- FUNCIÓN DE EXPORTACIÓN (ESTABLE) ---
const generateExport = async (elementId, fmt, filename) => {
    const input = document.getElementById(elementId);
    if (!input) return;
    window.scrollTo(0,0);
    
    const canvas = await html2canvas(input, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#fff', windowWidth: input.scrollWidth + 100,
        onclone: (doc) => {
            const d = doc.getElementById(elementId);
            d.style.width = 'max-content'; d.style.fontFamily = 'Arial';

            // Estilos Header
            const title = d.querySelector('h1'); if(title) { title.style.color='#000'; title.style.fontWeight='900'; }
            const sub = d.querySelector('p.text-xl'); if(sub) { sub.style.color='#000'; sub.style.fontWeight='bold'; }
            const headerRight = d.querySelector('.header-info-right'); 
            if(headerRight) { 
                const ps = headerRight.querySelectorAll('p'); 
                if(ps[0]) { ps[0].style.color='#000'; ps[0].style.fontWeight='900'; ps[0].style.fontSize='24px'; }
                if(ps[1]) { ps[1].style.color='#000'; ps[1].style.fontWeight='bold'; ps[1].style.fontSize='14px'; ps[1].style.marginTop='5px'; }
            }

            // Estilos Grid "Pixel Perfect"
            const container = d.querySelector('.grid-container');
            if(container) { container.style.borderTop = '1px solid #000'; container.style.borderLeft = '1px solid #000'; container.style.display = 'block'; }
            
            d.querySelectorAll('.grid-row').forEach(r => { r.style.border='none'; r.style.display='flex'; r.style.width='max-content'; });
            d.querySelectorAll('.name-cell, .day-cell, .total-cell').forEach(c => {
                c.style.border='none'; c.style.borderRight='1px solid #000'; c.style.borderBottom='1px solid #000';
                c.style.display='flex'; c.style.flexShrink='0'; c.style.flexGrow='0'; c.style.height='60px'; 
                c.style.boxSizing='border-box'; c.style.overflow='visible'; c.style.alignItems='center';
                
                if (c.classList.contains('name-cell')) { c.style.width='250px'; c.style.justifyContent='flex-start'; c.style.paddingLeft='8px'; }
                if (c.classList.contains('day-cell')) { 
                    c.style.width='40px'; c.style.justifyContent='center'; c.style.padding='0'; 
                    if(c.tagName==='BUTTON'){c.style.appearance='none';c.style.backgroundColor=window.getComputedStyle(c).backgroundColor;} 
                }
                if (c.classList.contains('total-cell')) { 
                    c.style.width='140px'; c.style.flexDirection='column'; c.style.justifyContent='center'; c.style.padding='0'; c.style.paddingBottom='24px'; 
                }
            });

            // Limpieza final
            d.querySelectorAll('.legend-square').forEach(l => { l.style.borderColor='#000'; l.style.height='24px'; l.style.width='32px'; l.style.display='flex'; l.style.alignItems='center'; l.style.justifyContent='center'; l.style.paddingBottom='0px'; l.style.lineHeight='1'; });
            d.querySelectorAll('button .lucide-trash-2').forEach(i => i.parentElement.remove()); // Borrar papeleras
            d.querySelectorAll('.truncate').forEach(t => t.classList.remove('truncate'));
        }
    });

    const img = canvas.toDataURL('image/jpeg', 0.95);
    if (fmt === 'jpg') { 
        const link = document.createElement('a'); link.download = `${filename}.jpg`; link.href = img; link.click(); 
    } else { 
        const pdf = new jsPDF('l','mm','a3');
        const props = pdf.getImageProperties(img); 
        pdf.addImage(img, 'JPEG', 0, 10, pdf.internal.pageSize.getWidth(), (props.height * pdf.internal.pageSize.getWidth()) / props.width);
        pdf.save(`${filename}.pdf`); 
    }
};

// ============================================================================
// COMPONENTE 1: WORKSPACE
// ============================================================================
const Workspace = ({ 
  projectId, projectName, onChangeProject, onCreateProject, onDeleteProject, onRenameProject,
  installPrompt, onInstall, onExportData, onImportData
}) => {
  const K = (key) => `sentinel_v5.4_${projectId}_${key}`;

  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const saved = localStorage.getItem(K('date'));
      const date = saved ? new Date(saved) : new Date();
      return isNaN(date.getTime()) ? new Date() : date;
    } catch { return new Date(); }
  });

  const [mode, setMode] = useState(() => loadState(K('mode'), '8H'));
  const [startHour, setStartHour] = useState(() => loadState(K('startHour'), "07:00"));
  const [staff, setStaff] = useState(() => loadState(K('staff'), INITIAL_STAFF));
  const [fullSchedule, setFullSchedule] = useState(() => loadState(K('full_schedule'), {}));
  const [customHolidays, setCustomHolidays] = useState(() => loadState(K('holidays'), {}));
  const [customShifts, setCustomShifts] = useState(() => loadState(K('custom_shifts'), {}));

  // Estados UI
  const [activeCell, setActiveCell] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); 
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  
  const [isRenamingService, setIsRenamingService] = useState(false);
  const [tempServiceName, setTempServiceName] = useState(projectName);

  const [showInputModal, setShowInputModal] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputRole, setInputRole] = useState('VS');
  const [inputMode, setInputMode] = useState('add');
  const [editingId, setEditingId] = useState(null);

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShiftCode, setNewShiftCode] = useState('');
  const [newShiftDesc, setNewShiftDesc] = useState('');
  const [newShiftHours, setNewShiftHours] = useState(''); 
  const [newShiftStart, setNewShiftStart] = useState(''); 
  const [newShiftNight, setNewShiftNight] = useState(0);
  const [newShiftColor, setNewShiftColor] = useState(CUSTOM_COLORS[0].class);

  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [lastSelectedCell, setLastSelectedCell] = useState(null);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => { setTempServiceName(projectName); }, [projectName]);

  // Persistencia
  useEffect(() => localStorage.setItem(K('date'), currentDate.toISOString()), [currentDate, projectId]);
  useEffect(() => localStorage.setItem(K('mode'), JSON.stringify(mode)), [mode, projectId]);
  useEffect(() => localStorage.setItem(K('startHour'), JSON.stringify(startHour)), [startHour, projectId]);
  useEffect(() => localStorage.setItem(K('staff'), JSON.stringify(staff)), [staff, projectId]);
  useEffect(() => localStorage.setItem(K('full_schedule'), JSON.stringify(fullSchedule)), [fullSchedule, projectId]);
  useEffect(() => localStorage.setItem(K('holidays'), JSON.stringify(customHolidays)), [customHolidays, projectId]);
  useEffect(() => localStorage.setItem(K('custom_shifts'), JSON.stringify(customShifts)), [customShifts, projectId]);

  // Indicador de guardado automático
  useEffect(() => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [staff, fullSchedule, customHolidays, customShifts, mode, startHour]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
      if (newShiftStart !== '' && newShiftHours > 0) {
          const s = timeToDecimal(newShiftStart);
          const d = parseFloat(newShiftHours);
          setNewShiftNight(calculateNightHoursForShift(s, d));
      }
  }, [newShiftStart, newShiftHours]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = `${year}-${month}`;

  const currentSchedule = useMemo(() => fullSchedule[monthKey] || {}, [fullSchedule, monthKey]);
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth()}`;
  const prevMonthSchedule = useMemo(() => fullSchedule[prevMonthKey] || {}, [fullSchedule, prevMonthKey]);

  useEffect(() => {
    setFullSchedule(prev => {
        const currentMonthData = prev[monthKey] || {};
        let hasChanges = false;
        const newMonthData = { ...currentMonthData };
        staff.forEach(s => {
            if (!newMonthData[s.id] || newMonthData[s.id].length !== daysInMonth) {
                const existingRow = newMonthData[s.id] || [];
                newMonthData[s.id] = existingRow.length < daysInMonth ? [...existingRow, ...Array(daysInMonth - existingRow.length).fill('L')] : existingRow.slice(0, daysInMonth);
                hasChanges = true;
            }
        });
        return hasChanges ? { ...prev, [monthKey]: newMonthData } : prev;
    });
  }, [monthKey, daysInMonth, staff]);

  const setShift = (sId, dIdx, code) => {
      setFullSchedule(prev => {
          const newFull = { ...prev };
          const monthData = { ...(newFull[monthKey] || {}) };
          if (!monthData[sId]) monthData[sId] = Array(daysInMonth).fill('L');
          const newRow = [...monthData[sId]];
          newRow[dIdx] = code;
          monthData[sId] = newRow;
          newFull[monthKey] = monthData;
          return newFull;
      });
      setActiveCell(null);
  };

  const applyMultiShift = (code) => {
      if (selectedCells.size === 0) return;
      setFullSchedule(prev => {
          const newFull = { ...prev };
          const monthData = { ...(newFull[monthKey] || {}) };
          selectedCells.forEach(k => {
              const [sId, dIdx] = k.split('-').map(Number);
              if (!monthData[sId]) monthData[sId] = Array(daysInMonth).fill('L');
              if (monthData[sId] === prev[monthKey]?.[sId]) monthData[sId] = [...monthData[sId]];
              monthData[sId][dIdx] = code;
          });
          newFull[monthKey] = monthData;
          return newFull;
      });
  };

  const isWeekend = (d) => [0, 6].includes(new Date(year, month, d + 1).getDay());
  const isSunday = (d) => new Date(year, month, d + 1).getDay() === 0;
  const isHoliday = (d) => customHolidays[`${year}-${month}-${d + 1}`] || FIXED_HOLIDAYS.includes(`${d + 1}/${month}`);
  
  const toggleHoliday = (d) => {
    const k = `${year}-${month}-${d + 1}`;
    setCustomHolidays(p => { const n = {...p}; n[k] ? delete n[k] : n[k] = true; return n; });
  };

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
    setActiveCell(null); setIsSelectionMode(false); setSelectedCells(new Set()); setLastSelectedCell(null);
  };

  const shiftConfig = useMemo(() => {
    const h = typeof startHour === 'string' ? timeToDecimal(startHour) : startHour;
    const end8h = (s) => (s + 8) % 24; 
    const end12h = (s) => (s + 12) % 24;
    const fmt = (dec) => decimalToTime(dec);

    return {
      '8H': {
        label: '8 Horas', slots: ['M', 'T', 'N'],
        types: {
          'M': { label: 'Mañana', hours: 8, nightHours: calculateNightHoursForShift(h, 8), color: 'bg-blue-100 text-blue-800 border-blue-200', desc: `${fmt(h)}-${fmt(end8h(h))}`, start: h },
          'T': { label: 'Tarde', hours: 8, nightHours: calculateNightHoursForShift(end8h(h), 8), color: 'bg-orange-100 text-orange-800 border-orange-200', desc: `${fmt(end8h(h))}-${fmt(end8h(h+8))}`, start: end8h(h) },
          'N': { label: 'Noche', hours: 8, nightHours: calculateNightHoursForShift(end8h(h+8), 8), color: 'bg-slate-800 text-white border-slate-600', desc: `${fmt(end8h(h+8))}-${fmt(end8h(h+16))}`, start: end8h(h+8) },
        }
      },
      '12H': {
        label: '12 Horas', slots: ['D', 'N'],
        types: {
          'D': { label: 'Día', hours: 12, nightHours: calculateNightHoursForShift(h, 12), color: 'bg-amber-100 text-amber-800 border-amber-200', desc: `${fmt(h)}-${fmt(end12h(h))}`, start: h },
          'N': { label: 'Noche', hours: 12, nightHours: calculateNightHoursForShift(end12h(h), 12), color: 'bg-slate-800 text-slate-100 border-slate-600', desc: `${fmt(end12h(h))}-${fmt(end12h(h+12))}`, start: end12h(h) },
        }
      }
    };
  }, [startHour]);

  const SPECIAL_CODES = {
    'L': { label: 'Libre', hours: 0, color: 'bg-white text-slate-300 border-slate-200', computation: 0, desc: 'Descanso' },
    'V': { label: 'Vacaciones', hours: 0, color: 'bg-green-100 text-green-800 border-green-200', computation: 5.4, desc: 'Computa 5.4h' },
    'AP': { label: 'A. Propios', hours: 0, color: 'bg-purple-100 text-purple-800 border-purple-200', computation: 0, desc: 'Asuntos Propios' },
    'B': { label: 'Baja', hours: 0, color: 'bg-red-100 text-red-800 border-red-200', computation: 0, desc: 'Baja Médica' },
  };

  const handleCellClick = (e, sId, dIdx) => {
    if (isExporting) return;
    if (isSelectionMode) {
        if (e.shiftKey && lastSelectedCell && lastSelectedCell.staffId === sId) {
            const start = Math.min(lastSelectedCell.dayIndex, dIdx);
            const end = Math.max(lastSelectedCell.dayIndex, dIdx);
            setSelectedCells(prev => {
                const newSet = new Set(prev);
                for (let i = start; i <= end; i++) newSet.add(`${sId}-${i}`);
                return newSet;
            });
        } else {
            const k = `${sId}-${dIdx}`;
            setSelectedCells(p => { 
                const n = new Set(p); 
                if (n.has(k)) n.delete(k); else n.add(k); 
                return n; 
            });
            setLastSelectedCell({ staffId: sId, dayIndex: dIdx });
        }
    } else {
        const r = e.currentTarget.getBoundingClientRect();
        setActiveCell({ staffId: sId, dayIndex: dIdx, top: r.bottom + window.scrollY, left: r.left + window.scrollX - 50, mobileName: staff.find(s => s.id === sId)?.name });
    }
  };

  const handleRowSelect = (sId) => {
    if (!isSelectionMode) return;
    const allRow = Array.from({length: daysInMonth}).map((_, i) => `${sId}-${i}`);
    const allSelected = allRow.every(k => selectedCells.has(k));
    setSelectedCells(p => { const n = new Set(p); allRow.forEach(k => allSelected ? n.delete(k) : n.add(k)); return n; });
    setLastSelectedCell(null);
  };

  const calculateStats = (sId) => {
    const sData = currentSchedule[sId] || [];
    let st = { total: 0, night: 0, festive: 0 };
    sData.forEach((c, idx) => {
        const type = customShifts[c] || shiftConfig[mode].types[c];
        if (type) {
            st.total += type.hours; st.night += type.nightHours;
            if (isSunday(idx) || isHoliday(idx)) st.festive += type.hours;
        } else if (SPECIAL_CODES[c]) st.total += SPECIAL_CODES[c].computation;
    });
    st.total = Math.round(st.total * 100) / 100;
    return st;
  };

  const generateWhatsAppSummary = () => {
    let text = `🛡️ *CUADRANTE ${projectName.toUpperCase()}*\n`;
    text += `📅 ${MONTH_NAMES[month]} ${year}\n\n`;

    for (let day = 0; day < daysInMonth; day++) {
        const dayNum = day + 1;
        const shifts = {};
        staff.forEach(s => {
            const code = currentSchedule[s.id]?.[day];
            if (code && code !== 'L') {
                if(!shifts[code]) shifts[code] = [];
                shifts[code].push(s.name.split(',')[0]);
            }
        });

        if (Object.values(shifts).some(arr => arr.length > 0)) {
            text += `🗓️ *Día ${dayNum}:*\n`;
            if (shifts['M']?.length) text += `☀️ M: ${shifts['M'].join(', ')}\n`;
            if (shifts['D']?.length) text += `☀️ D: ${shifts['D'].join(', ')}\n`;
            if (shifts['T']?.length) text += `🌤️ T: ${shifts['T'].join(', ')}\n`;
            if (shifts['N']?.length) text += `🌙 N: ${shifts['N'].join(', ')}\n`;
            text += `----------------\n`;
        }
    }
    
    navigator.clipboard.writeText(text).then(() => {
        alert("¡Resumen copiado! Pégalo en WhatsApp.");
    });
  };

  const dailyCoverageStatus = useMemo(() => {
    const status = [];
    const requiredSlots = shiftConfig[mode].slots;
    const currentTypes = shiftConfig[mode].types;
    for (let day = 0; day < daysInMonth; day++) {
      const shiftsPresentToday = new Set();
      let hoursCovered = 0;
      staff.forEach(s => {
        const shiftCode = currentSchedule[s.id]?.[day];
        if (currentTypes[shiftCode] || customShifts[shiftCode]) {
          shiftsPresentToday.add(shiftCode);
          const h = currentTypes[shiftCode]?.hours || customShifts[shiftCode]?.hours || 0;
          hoursCovered += h;
        }
      });
      const missingSlots = requiredSlots.filter(slot => !shiftsPresentToday.has(slot));
      status.push({ isComplete: missingSlots.length === 0, hoursCovered, missing: missingSlots });
    }
    return status;
  }, [currentSchedule, staff, mode, shiftConfig, daysInMonth, customShifts]);

  const saveCustomShift = () => {
      if (!newShiftCode || !newShiftDesc) return alert("Código y descripción requeridos");
      const hours = parseFloat(newShiftHours);
      if (hours > 12) return alert("⚠️ Máximo 12 horas por turno.");

      let description = `${hours}h`;
      if (newShiftStart !== '') {
          const startDec = timeToDecimal(newShiftStart);
          const endDec = (startDec + hours) % 24;
          description = `${newShiftStart}-${decimalToTime(endDec)}`;
      }

      setCustomShifts(p => ({
          ...p, 
          [newShiftCode.toUpperCase()]: { 
              label: newShiftDesc, 
              hours: hours, 
              nightHours: parseFloat(newShiftNight), 
              color: newShiftColor, 
              desc: description,
              startTime: newShiftStart 
          }
      }));
      setShowShiftModal(false); 
      setNewShiftCode(''); setNewShiftDesc(''); setNewShiftHours(''); setNewShiftStart(''); setNewShiftNight(0);
  };

  const deleteCustomShift = (code) => {
      if(window.confirm(`¿Eliminar turno ${code}?`)) setCustomShifts(p => { const n={...p}; delete n[code]; return n; });
  };

  const handleSaveInputName = () => {
    if (!inputName.trim()) return;
    if (inputMode === 'add') {
        const newId = staff.length > 0 ? Math.max(...staff.map(s => s.id)) + 1 : 1;
        setStaff([...staff, { id: newId, name: inputName, hoursContract: 162, role: inputRole }]);
    } else {
        setStaff(staff.map(s => s.id === editingId ? { ...s, name: inputName, role: inputRole } : s));
    }
    setShowInputModal(false);
  };

  const openAddEmployeeModal = () => { setInputMode('add'); setInputName(''); setInputRole('VS'); setShowInputModal(true); };
  const openEditEmployeeModal = (employee) => { setInputMode('edit'); setInputName(employee.name); setInputRole(employee.role || 'VS'); setEditingId(employee.id); setShowInputModal(true); };

  const handleConfirmAction = () => {
    if (pendingAction === 'clear') {
        setFullSchedule(prev => ({ ...prev, [monthKey]: staff.reduce((acc, s) => ({...acc, [s.id]: Array(daysInMonth).fill('L')}), {}) }));
    } else if (pendingAction === 'delete_staff' && pendingId) {
        setStaff(staff.filter(s => s.id !== pendingId));
        setFullSchedule(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(mk => { if (next[mk][pendingId]) { const monthData = { ...next[mk] }; delete monthData[pendingId]; next[mk] = monthData; } });
            return next;
        });
    }
    setShowConfirmModal(false); setPendingAction(null); setPendingId(null); setActiveCell(null);
  };

  const handleExportClick = (fmt) => {
      setIsExporting(true); setActiveCell(null); setIsSelectionMode(false); setShowDesktopMenu(false); setShowMobileMenu(false);
      setTimeout(() =>
          generateExport('printable-area', fmt, `Cuadrante_${projectName.replace(/\s+/g,'_')}_${MONTH_NAMES[month]}_${year}`)
              .then(() => { setIsExporting(false); setExportDone(true); setTimeout(() => setExportDone(false), 2500); }),
      800);
  };

  const gridContainerClass = isExporting ? 'grid-container inline-block' : 'inline-block min-w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden';
  const rowClass = isExporting ? 'flex grid-row' : 'flex border-b border-slate-100 h-12 md:h-10 group bg-white';
  const headerRowClass = isExporting ? 'flex grid-row bg-slate-100' : 'flex border-b border-slate-200 h-10 bg-slate-100';

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm relative z-40">
          <div className="flex items-center gap-2 group relative">
             <div
               className="flex items-center gap-2 cursor-pointer"
               onClick={() => { if (!isRenamingService) setIsRenamingService(true); }}
             >
                {isRenamingService ? (
                    <input
                        autoFocus
                        value={tempServiceName}
                        onChange={(e) => setTempServiceName(e.target.value)}
                        onBlur={() => { onRenameProject(tempServiceName); setIsRenamingService(false); }}
                        onKeyDown={(e) => { if(e.key==='Enter'){ onRenameProject(tempServiceName); setIsRenamingService(false); } }}
                        className="text-lg font-bold text-slate-700 bg-transparent border-b border-blue-500 outline-none w-full md:w-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="text-lg font-bold text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-2">
                        {projectName}
                        <Edit3 className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                    </span>
                )}
             </div>
             {/* Indicador auto-guardado */}
             <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-all duration-500 ${saved ? 'bg-green-100 text-green-700 opacity-100' : 'opacity-0'}`}>
               ✓ Guardado
             </span>
          </div>

          {/* BARRA DE HERRAMIENTAS - ADAPTADA PARA MÓVIL */}
          <div className="flex w-full md:w-auto gap-2 items-center">
             
             {/* 1. BOTÓN SELECCIÓN (IZQUIERDA) */}
             <button 
                onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedCells(new Set()); setLastSelectedCell(null); }}
                className={`md:hidden p-2 border rounded transition-colors ${isSelectionMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
             >
                {isSelectionMode ? <CheckSquare className="w-5 h-5" /> : <MousePointer2 className="w-5 h-5" />}
             </button>

             {/* 2. BOTÓN ALTA VS (CENTRO/EXPANDIDO) */}
             <button onClick={() => { setInputMode('add'); setInputName(''); setInputRole('VS'); setShowInputModal(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-bold md:ml-auto order-2 md:order-3"><UserPlus className="w-4 h-4" /> <span className="hidden md:inline">Alta Personal</span><span className="md:hidden">Alta</span></button>

             {/* 3. MENÚ MÓVIL (DERECHA) */}
             <div className="md:hidden relative order-3">
                <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 border rounded bg-slate-100 text-slate-600"><MoreVertical className="w-5 h-5"/></button>
                {showMobileMenu && (
                   <>
                   <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)}></div>
                   <div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-xl rounded-lg border z-[2000] overflow-hidden">
                      <div className="p-2 bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cuadrante</div>
                      <button onClick={() => { generateWhatsAppSummary(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-green-700 font-medium"><Share2 className="w-4 h-4" /> Copiar resumen WhatsApp</button>
                      <button onClick={() => { setShowShiftModal(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700"><PlusCircle className="w-4 h-4 text-purple-600" /> Crear turno personalizado</button>
                      <div className="p-2 bg-slate-50 border-b border-t text-[10px] font-bold text-slate-500 uppercase tracking-wider">Guardar cuadrante</div>
                      <button onClick={() => { handleExportClick('jpg'); }} disabled={isExporting} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700 disabled:opacity-50">
                         {isExporting ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" /> : <ImageIcon className="w-4 h-4" />} Guardar como JPG
                      </button>
                      <button onClick={() => { handleExportClick('pdf'); }} disabled={isExporting} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700 border-b border-slate-100 disabled:opacity-50">
                         {isExporting ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" /> : <FileIcon className="w-4 h-4" />} Guardar como PDF
                      </button>
                      <div className="p-2 bg-slate-50 border-b border-t text-[10px] font-bold text-slate-500 uppercase tracking-wider">Copia de seguridad</div>
                      <button onClick={() => { onExportData(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-blue-50 text-blue-700"><UploadCloud className="w-4 h-4" /> Hacer backup (.json)</button>
                      <button onClick={() => { onImportData(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-blue-50 text-blue-700 border-b border-slate-100"><DownloadCloud className="w-4 h-4" /> Restaurar backup</button>
                      {!isStandalone && (
                        <button onClick={() => { if(installPrompt) onInstall(); else setShowInstallHelp(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-blue-600 font-medium border-b border-slate-100"><Download className="w-4 h-4" /> Instalar App</button>
                      )}
                      <div className="bg-red-50 border-t border-slate-100">
                         <button onClick={() => { setPendingAction('clear'); setShowConfirmModal(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-red-100 text-red-600 font-medium"><Eraser className="w-4 h-4" /> Limpiar cuadrante</button>
                      </div>
                   </div>
                   </>
                )}
             </div>

             {/* ACCIONES DESKTOP */}
             <div className="hidden md:flex gap-2 order-2 relative items-center">
                 <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedCells(new Set()); setLastSelectedCell(null); }} className={`shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-bold border rounded ${isSelectionMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {isSelectionMode ? <CheckSquare className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
                    <span className="hidden md:inline">{isSelectionMode ? 'Terminar' : 'Selección'}</span>
                 </button>

                 {/* Export rápido visible */}
                 <button
                    onClick={() => handleExportClick('jpg')}
                    disabled={isExporting}
                    title="Guardar cuadrante como imagen JPG"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold border rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                 >
                    {isExporting ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" /> : <ImageIcon className="w-4 h-4" />}
                    <span className="hidden lg:inline">JPG</span>
                 </button>
                 <button
                    onClick={() => handleExportClick('pdf')}
                    disabled={isExporting}
                    title="Guardar cuadrante como PDF"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold border rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                 >
                    {isExporting ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" /> : <FileIcon className="w-4 h-4" />}
                    <span className="hidden lg:inline">PDF</span>
                 </button>

                 {/* MENU DESKTOP — Más opciones */}
                 <div className="relative">
                    <button onClick={() => setShowDesktopMenu(!showDesktopMenu)} className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-bold border rounded bg-white text-slate-600 hover:bg-slate-50">
                       <Menu className="w-4 h-4" />
                    </button>
                    {showDesktopMenu && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowDesktopMenu(false)}></div>
                            <div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-xl rounded-lg border z-40 overflow-hidden">
                                <div className="p-2 bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cuadrante</div>
                                <button onClick={() => { generateWhatsAppSummary(); setShowDesktopMenu(false); }} className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 text-sm border-b border-slate-100"><Share2 className="w-4 h-4 text-green-600" /> Copiar resumen WhatsApp</button>
                                <button onClick={() => setShowShiftModal(true) || setShowDesktopMenu(false)} className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 text-sm border-b border-slate-100"><PlusCircle className="w-4 h-4 text-purple-600" /> Crear turno personalizado</button>
                                <div className="p-2 bg-slate-50 border-b border-t text-[10px] font-bold text-slate-500 uppercase tracking-wider">Copia de seguridad</div>
                                <button onClick={() => { onExportData(); setShowDesktopMenu(false); }} className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-blue-50 text-blue-700 text-sm border-b border-slate-100"><UploadCloud className="w-4 h-4" /> Hacer backup (.json)</button>
                                <button onClick={() => { onImportData(); setShowDesktopMenu(false); }} className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-blue-50 text-blue-700 text-sm border-b border-slate-100"><DownloadCloud className="w-4 h-4" /> Restaurar backup</button>
                                <div className="p-2 bg-red-50 border-t border-slate-100">
                                   <button onClick={() => { setPendingAction('clear'); setShowConfirmModal(true); setShowDesktopMenu(false); }} className="w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-red-100 text-red-600 text-sm rounded">
                                      <Eraser className="w-4 h-4" /> Limpiar cuadrante
                                   </button>
                                </div>
                            </div>
                        </>
                    )}
                 </div>

                 <button onClick={() => setShowShiftModal(true)} className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs bg-purple-600 text-white rounded shadow hover:bg-purple-700 font-bold">
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden lg:inline">Turno</span>
                 </button>
             </div>
          </div>
      </div>

      <div className="bg-slate-100 p-2 flex justify-between items-center border-b border-slate-200">
         <div className="flex items-center bg-white p-1 rounded border border-slate-300">
            <button onClick={() => changeMonth(-1)} className="px-2 font-bold text-slate-500 hover:bg-slate-50">&lt;</button>
            <span className="px-2 text-sm font-bold text-slate-700 w-32 text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={() => changeMonth(1)} className="px-2 font-bold text-slate-500 hover:bg-slate-50">&gt;</button>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border rounded p-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <input 
                    type="time" 
                    value={startHour} 
                    onChange={(e) => setStartHour(e.target.value)} 
                    className="text-xs font-mono outline-none text-slate-700 bg-transparent w-16"
                />
            </div>
            <div className="flex bg-white rounded border border-slate-300 overflow-hidden">
                {['8H', '12H'].map(m => <button key={m} onClick={() => setMode(m)} className={`px-2 py-1 text-xs font-bold ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{m}</button>)}
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-50" id="scroll-container">
        <div id="printable-area" className={gridContainerClass}>
            <div className="mb-6 border-b-2 border-slate-800 pb-4 hidden" style={{ display: isExporting ? 'block' : 'none' }}>
                <div className="flex justify-between items-end">
                    <div><h1 className="text-3xl font-bold uppercase">Cuadrante Mensual</h1><p className="text-xl text-slate-600">{projectName}</p></div>
                    <div className="text-right header-info-right"><p className="text-2xl font-bold text-blue-900 uppercase">{MONTH_NAMES[month]} {year}</p><p className="text-xs font-mono">MODO: {mode} | INICIO: {startHour}</p></div>
                </div>
            </div>

            <div className={isExporting ? 'flex grid-row bg-slate-100' : 'flex border-b border-slate-200 h-10 bg-slate-100'}>
                <div className={isExporting ? 'name-cell font-bold text-slate-600 text-[10px] uppercase bg-slate-100' : 'w-32 md:w-48 shrink-0 flex items-center justify-center border-r border-slate-200 sticky left-0 z-10 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'}>
                    <User className="w-4 h-4 text-slate-400" />
                </div>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                    <div key={i} onClick={() => toggleHoliday(i)} className={`${isExporting ? 'day-cell text-[10px] font-bold' : 'w-9 shrink-0 flex items-center justify-center border-r border-slate-200 cursor-pointer hover:bg-red-50 transition-colors'} ${isHoliday(i) ? 'bg-red-100 text-red-700' : (isWeekend(i) ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400')}`}>
                        <span className="text-[10px] font-bold">{i + 1}</span>
                    </div>
                ))}
                <div className={isExporting ? 'total-cell font-bold text-[9px] bg-white' : 'w-24 md:w-28 shrink-0 flex items-center justify-center sticky right-0 z-10 bg-white border-l border-slate-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] font-bold text-slate-600'}>Total</div>
            </div>

            {staff.map((emp) => {
                const stats = calculateStats(emp.id);
                const hClass = stats.total > emp.hoursContract ? 'text-red-600 font-bold' : (stats.total < emp.hoursContract - 12 ? 'text-orange-500' : 'text-green-600');
                return (
                    <div key={emp.id} className={isExporting ? 'flex grid-row' : 'flex border-b border-slate-100 h-12 md:h-10 group bg-white'}>
                        <div className={isExporting ? 'name-cell text-sm font-bold text-slate-900 bg-white' : 'w-32 md:w-48 shrink-0 px-2 flex flex-col justify-center sticky left-0 z-10 bg-white border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-50'} onClick={() => handleRowSelect(emp.id)}>
                            <div className="flex justify-between items-center w-full">
                                <div className="overflow-hidden">
                                    <span className="font-bold text-xs md:text-sm text-slate-900 block truncate">{emp.name}</span>
                                    <span className="text-[9px] text-slate-400 uppercase">{emp.role}</span>
                                </div>
                                {!isExporting && !isSelectionMode && <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEditEmployeeModal(emp); }} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-3 h-3" /></button><button onClick={(e) => { e.stopPropagation(); setPendingAction('delete_staff'); setPendingId(emp.id); setShowConfirmModal(true); }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>}
                            </div>
                        </div>
                        {currentSchedule[emp.id]?.slice(0, daysInMonth).map((shift, d) => {
                            const data = customShifts[shift] || shiftConfig[mode].types[shift] || SPECIAL_CODES[shift];
                            const isActive = activeCell?.staffId === emp.id && activeCell?.dayIndex === d;
                            const isSel = selectedCells.has(`${emp.id}-${d}`);
                            const isValid = !!data;
                            const holiday = isHoliday(d);
                            const wknd = isWeekend(d);

                            let prevShift = null;
                            if (d > 0) { prevShift = currentSchedule[emp.id][d-1]; } 
                            else { const prevEmpSchedule = prevMonthSchedule[emp.id] || []; if (prevEmpSchedule.length > 0) prevShift = prevEmpSchedule[prevEmpSchedule.length - 1]; }
                            
                            const violation = checkRestViolation(prevShift, shift, mode, shiftConfig, customShifts, startHour);
                            const violationClass = violation && !isSel ? 'ring-2 ring-red-600 ring-inset z-20' : '';
                            const borderClass = isSel ? '!bg-indigo-600 !text-white !border-indigo-700 z-30 shadow-md ring-1 ring-white' : (isActive ? 'bg-blue-600 text-white z-20 shadow-lg scale-110' : '');

                            const baseClass = isExporting 
                                ? `day-cell text-[10px] font-bold ${isValid ? data.color : (holiday ? 'bg-red-100 text-red-700' : (wknd ? 'bg-slate-300' : ''))}` 
                                : `w-9 shrink-0 flex items-center justify-center border-r border-slate-100 text-[10px] md:text-xs font-bold transition-all relative ${holiday && !isValid ? 'bg-red-100 text-red-700' : ''} ${wknd && !isValid && !holiday ? 'bg-slate-300 text-slate-700' : ''} ${isValid ? data.color : (data ? '' : 'bg-slate-50 text-slate-300 line-through')} active:scale-95 ${borderClass} ${violationClass}`;
                            
                            return (
                                <button 
                                    key={d} 
                                    onClick={(e) => handleCellClick(e, emp.id, d)} 
                                    className={baseClass}
                                    title={violation ? `Descanso insuficiente` : ''}
                                >
                                    {shift !== 'L' && shift}
                                    {violation && !isExporting && !isSel && <div className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-bl-lg flex items-center justify-center shadow-sm"><span className="text-[8px] text-white font-bold">!</span></div>}
                                </button>
                            );
                        })}
                        <div className={isExporting ? 'total-cell font-bold text-[9px] bg-white' : 'w-24 md:w-28 shrink-0 flex flex-col justify-center items-center sticky right-0 z-10 bg-white border-l border-slate-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px]'}>
                            <div className={`flex items-center justify-between w-full px-1 mb-1 ${isExporting ? 'w-full justify-center mb-0 pb-0' : 'border-b border-slate-100 pb-1'}`}>
                                {!isExporting && <span className="font-bold text-slate-500">T</span>}<span className={`${hClass} ${isExporting ? 'text-sm mb-1 font-bold' : ''}`}>{isExporting ? `T: ${stats.total}` : stats.total}</span>
                            </div>
                            <div className={`flex items-center w-full px-1 text-xs text-slate-400 ${isExporting ? 'justify-center gap-3 text-[10px]' : 'justify-between'}`}>
                                <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> {stats.night}</span>
                                <span className="flex items-center gap-1"><Gift className="w-3 h-3" /> {stats.festive}</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {!isExporting && (
            <div className="flex border-t-2 border-slate-200 bg-slate-50 h-8 mt-1">
                <div className="w-32 md:w-48 shrink-0 px-3 text-[10px] font-bold uppercase text-slate-500 border-r border-slate-200 flex items-center sticky left-0 z-10 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Cobertura
                </div>
                {dailyCoverageStatus.map((status, i) => (
                    <div key={i} className={`w-9 shrink-0 flex items-center justify-center border-r border-slate-200 text-[9px] font-bold ${status.isComplete ? 'text-green-600 bg-green-50' : 'text-white bg-red-500'}`}>
                        {status.isComplete ? 'OK' : '!'}
                    </div>
                ))}
                <div className="w-16 md:w-20 shrink-0 border-l border-slate-200 sticky right-0 bg-slate-50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]"></div>
            </div>
            )}

            <div className={`mt-8 px-8 pt-4 border-t border-slate-200 ${isExporting ? 'block' : 'hidden'}`}>
                <div className="text-[10px] text-slate-500 flex flex-wrap gap-4 mt-8">
                  <span className="font-bold uppercase text-slate-700">Leyenda:</span>
                  {Object.entries(shiftConfig[mode].types).map(([c, d]) => (<span key={c} className="flex items-center gap-1"><span className="font-bold border border-slate-300 px-1 bg-white text-slate-800 legend-square">{c}</span><span>{d.label} <span className="text-slate-400 font-mono ml-1">({d.desc})</span></span></span>))}
                  {Object.entries(customShifts).map(([c, d]) => (<span key={c} className="flex items-center gap-1"><span className={`font-bold border border-slate-300 px-1 legend-square ${d.color}`}>{c}</span><span>{d.label} <span className="text-slate-400 font-mono ml-1">({d.desc})</span></span></span>))}
                  <span className="flex items-center gap-1"><span className="font-bold border border-slate-300 px-1 bg-white text-slate-800 legend-square">V</span> Vacaciones</span>
                </div>
            </div>
        </div>
      </div>

      {isSelectionMode && selectedCells.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-[2000] flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center gap-2"><span className="font-bold text-slate-700">{selectedCells.size} seleccionadas</span><button onClick={() => setSelectedCells(new Set())} className="text-xs text-red-500 underline ml-2">Desmarcar</button></div>
                <div className="flex gap-2 overflow-x-auto max-w-full pb-1 no-scrollbar">
                    {/* BUTTONS IN MULTI-SELECTION BAR MODIFIED TO SHOW HOURS */}
                    {Object.entries(shiftConfig[mode].types).map(([c, d]) => (
                        <button key={c} onClick={() => applyMultiShift(c)} className={`px-3 py-2 rounded border flex flex-col items-center justify-center min-w-[3.5rem] transition-transform active:scale-95 ${d.color}`}>
                            <span className="font-bold">{c}</span>
                            <span className="text-[9px] whitespace-nowrap">{d.desc}</span>
                        </button>
                    ))}
                    {Object.entries(customShifts).map(([c, d]) => (
                        <button key={c} onClick={() => applyMultiShift(c)} className={`px-3 py-2 rounded border flex flex-col items-center justify-center min-w-[3.5rem] transition-transform active:scale-95 ${d.color}`}>
                            <span className="font-bold">{c}</span>
                            <span className="text-[9px] whitespace-nowrap">{d.desc}</span>
                        </button>
                    ))}
                    <div className="w-px bg-slate-300 mx-1"></div>
                    <button onClick={() => applyMultiShift('L')} className="px-3 py-2 rounded border bg-slate-100 text-slate-500 flex flex-col items-center justify-center min-w-[3.5rem]">
                        <span className="font-bold">L</span>
                        <span className="text-[9px]">Libre</span>
                    </button>
                    <button onClick={() => applyMultiShift('V')} className="px-3 py-2 rounded border bg-green-100 text-green-800 flex flex-col items-center justify-center min-w-[3.5rem]">
                        <span className="font-bold">V</span>
                        <span className="text-[9px]">5.4h</span>
                    </button>
                    <button onClick={() => applyMultiShift('B')} className="px-3 py-2 rounded border bg-red-100 text-red-800 flex flex-col items-center justify-center min-w-[3.5rem]">
                        <span className="font-bold">B</span>
                        <span className="text-[9px]">Baja</span>
                    </button>
                </div>
            </div>
      )}

      {/* MODALES */}
      {showInputModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-lg shadow-xl w-80">
                <h3 className="font-bold text-lg mb-4">{inputMode === 'add' ? 'Nuevo Personal' : 'Editar Datos'}</h3>
                <input autoFocus value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Nombre" className="w-full p-2 border rounded mb-2" />
                <input value={inputRole} onChange={e => setInputRole(e.target.value)} placeholder="Rol (Ej: VS)" className="w-full p-2 border rounded mb-4" />
                <div className="flex gap-2"><button onClick={() => setShowInputModal(false)} className="flex-1 p-2 bg-slate-200 rounded">Cancelar</button><button onClick={handleSaveInputName} className="flex-1 p-2 bg-blue-600 text-white rounded">Guardar</button></div>
            </div>
        </div>
      )}

      {showShiftModal && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-lg shadow-xl w-80">
                  <h3 className="font-bold text-lg mb-4">Crear Turno</h3>
                  <input maxLength={2} value={newShiftCode} onChange={e => setNewShiftCode(e.target.value.toUpperCase())} placeholder="Código (Ej: R)" className="w-full p-2 border rounded mb-2 uppercase font-bold" />
                  <input value={newShiftDesc} onChange={e => setNewShiftDesc(e.target.value)} placeholder="Descripción" className="w-full p-2 border rounded mb-2" />
                  <div className="flex gap-2 mb-2"><input type="number" value={newShiftHours} onChange={e => setNewShiftHours(e.target.value)} placeholder="Horas" className="w-1/3 p-2 border rounded" /><input type="time" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} className="w-1/3 p-2 border rounded" /><input type="number" value={newShiftNight} onChange={e => setNewShiftNight(e.target.value)} placeholder="Noc." className="w-1/3 p-2 border rounded" /></div>
                  <div className="flex gap-1 flex-wrap mb-4">{CUSTOM_COLORS.map(c => <button key={c.label} onClick={() => setNewShiftColor(c.class)} className={`w-6 h-6 rounded-full border ${c.class.split(' ')[0]} ${newShiftColor === c.class ? 'ring-2 ring-blue-500' : ''}`} />)}</div>
                  <div className="flex gap-2 mb-4">
                      <button onClick={() => setShowShiftModal(false)} className="flex-1 p-2 bg-slate-200 rounded">Cancelar</button>
                      <button onClick={saveCustomShift} className="flex-1 p-2 bg-purple-600 text-white rounded">Guardar</button>
                  </div>
                  {Object.keys(customShifts).length > 0 && (<div className="border-t pt-4"><h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Turnos Personalizados</h4><div className="space-y-2">{Object.entries(customShifts).map(([code, data]) => (<div key={code} className="flex justify-between items-center bg-slate-50 p-2 rounded border"><div className="flex items-center gap-2"><span className={`font-bold border px-1 rounded ${data.color}`}>{code}</span><span className="text-xs text-slate-600">{data.label} ({data.desc})</span></div><button onClick={() => deleteCustomShift(code)} className="text-red-400 hover:text-red-600 bg-white p-1 rounded border border-red-100"><Trash2 className="w-3 h-3" /></button></div>))}</div></div>)}
              </div>
          </div>
      )}
      
      {showConfirmModal && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-sm mx-4 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{pendingAction === 'clear' ? '¿Limpiar Cuadrante?' : '¿Eliminar Vigilante?'}</h3>
                    <p className="text-sm text-slate-500 mb-6">{pendingAction === 'clear' ? 'Se borrarán todos los turnos asignados.' : 'El vigilante se eliminará permanentemente.'}</p>
                    <div className="flex w-full gap-3">
                            <button onClick={() => setShowConfirmModal(false)} className="flex-1 px-4 py-2 bg-slate-100 font-bold rounded-lg">Cancelar</button><button onClick={() => { handleConfirmAction(); setShowConfirmModal(false); }} className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg">Confirmar</button>
                    </div>
                </div>
            </div>
      )}

      {/* Popover (Desktop) */}
      {activeCell && !isMobile && !isSelectionMode && (
          <div className="absolute z-50 bg-white rounded shadow-xl border p-3 w-72" style={{ top: activeCell.top, left: activeCell.left }}>
              <div className="grid grid-cols-3 gap-2">
                  {Object.entries(shiftConfig[mode].types).map(([c, d]) => (
                    <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`p-2 border rounded flex flex-col items-center justify-center transition-transform hover:scale-105 ${d.color}`}>
                       <span className="font-bold text-lg">{c}</span>
                       <span className="text-[10px] font-medium opacity-80">{d.desc}</span>
                    </button>
                  ))}
                  {Object.entries(customShifts).map(([c, d]) => (
                     <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`p-2 border rounded flex flex-col items-center justify-center transition-transform hover:scale-105 ${d.color}`}>
                       <span className="font-bold text-lg">{c}</span>
                       <span className="text-[10px] font-medium opacity-80">{d.desc}</span>
                    </button>
                  ))}
                  <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'L')} className="p-2 border rounded bg-slate-100 text-slate-500 flex flex-col items-center justify-center hover:bg-slate-200">
                     <span className="font-bold">L</span>
                     <span className="text-[9px]">Libre</span>
                  </button>
                  <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'V')} className="p-2 border rounded bg-green-100 text-green-800 flex flex-col items-center justify-center hover:bg-green-200">
                     <span className="font-bold">V</span>
                     <span className="text-[9px]">5.4h</span>
                  </button>
                  <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'B')} className="p-2 border rounded bg-red-100 text-red-800 flex flex-col items-center justify-center hover:bg-red-200">
                      <div className="flex items-center gap-1"><span className="font-bold">B</span></div>
                      <span className="text-[9px]">Baja</span>
                  </button>
              </div>
          </div>
      )}

      {/* Bottom Sheet (Mobile) */}
      {activeCell && isMobile && (
           <div className="fixed inset-0 z-[2000] flex flex-col justify-end animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveCell(null)}></div>
              <div className="bg-white rounded-t-2xl p-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 pb-8">
                  <div className="flex justify-between items-center mb-4">
                      <div><p className="text-xs text-slate-400 font-bold uppercase">{activeCell.dayIndex + 1} de {MONTH_NAMES[month]}</p><h3 className="font-bold text-lg text-slate-800">{activeCell.mobileName}</h3></div>
                      <button onClick={() => setActiveCell(null)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                     {Object.entries(shiftConfig[mode].types).map(([c, d]) => (
                       <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-transform active:scale-95 ${d.color.replace('bg-', 'bg-').replace('text-', 'text-').replace('border-', 'border-')}`}>
                         <span className="text-2xl font-bold">{c}</span><span className="text-[10px] opacity-70 mt-1">{d.desc}</span>
                       </button>
                     ))}
                     {/* TURNOS PERSONALIZADOS */}
                     {Object.entries(customShifts).map(([c, d]) => (
                       <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-transform active:scale-95 ${d.color.replace('bg-', 'bg-').replace('text-', 'text-').replace('border-', 'border-')}`}>
                         <span className="text-2xl font-bold">{c}</span><span className="text-[10px] opacity-70 mt-1">{d.desc}</span>
                       </button>
                     ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'L')} className="p-3 rounded-lg border text-sm font-bold bg-slate-100 text-slate-500 border-slate-200">Libre</button>
                     <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'V')} className="p-3 rounded-lg border text-sm font-bold bg-green-100 text-green-800 border-green-200">Vacaciones</button>
                     <button onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, 'B')} className="p-3 rounded-lg border text-sm font-bold bg-red-100 text-red-800 border-red-200 flex items-center justify-center gap-2"><Thermometer className="w-4 h-4"/> Baja</button>
                  </div>
              </div>
           </div>
      )}
      {activeCell && !isMobile && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveCell(null)} />}

      {/* Toast de exportación */}
      {(isExporting || exportDone) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[4000] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white transition-all"
          style={{ background: exportDone ? '#16a34a' : '#1e40af' }}>
          {isExporting
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Generando archivo…</>
            : <><Check className="w-4 h-4" /> ¡Archivo descargado!</>
          }
        </div>
      )}

      {showInstallHelp && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-lg">Instalar Aplicación</h3>
                   <button onClick={() => setShowInstallHelp(false)}><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                   No se ha podido iniciar la instalación automática.
                </p>
                <button onClick={() => setShowInstallHelp(false)} className="w-full p-2 bg-blue-600 text-white rounded font-bold">Entendido</button>
            </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// GESTOR DE PROYECTOS (Project Manager)
// ============================================================================
const SentinelProjectManager = () => {
  const [projects, setProjects] = useState(() => {
    try {
        const loaded = localStorage.getItem('sentinel_v4_projects');
        const parsed = loaded ? JSON.parse(loaded) : null;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        return [{ id: 'main', name: 'Servicio Principal' }];
    } catch { return [{ id: 'main', name: 'Servicio Principal' }]; }
  });

  const [activeProjectId, setActiveProjectId] = useState(() => {
      const saved = localStorage.getItem('sentinel_v4_active_project');
      return saved || 'main';
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => localStorage.setItem('sentinel_v4_projects', JSON.stringify(projects)), [projects]);
  useEffect(() => localStorage.setItem('sentinel_v4_active_project', activeProjectId), [activeProjectId]);

  useEffect(() => {
      const handler = (e) => {
          e.preventDefault();
          setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
  };
  
  const handleExportData = () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('sentinel_')) data[key] = localStorage.getItem(key);
      }
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
              try {
                  const data = JSON.parse(ev.target.result);
                  if (!Object.keys(data).some(k => k.startsWith('sentinel_')))
                      throw new Error('Formato inválido');
                  Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
                  window.location.reload();
              } catch {
                  alert('Archivo inválido. Asegúrate de usar un backup de Sentinel Shift.');
              }
          };
          reader.readAsText(file);
      };
      input.click();
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const createProject = () => {
    const name = prompt("Nombre del nuevo servicio:");
    if (!name) return;
    const newId = `p_${Date.now()}`;
    setProjects([...projects, { id: newId, name }]);
    setActiveProjectId(newId);
    setIsMenuOpen(false);
  };

  const deleteProject = () => {
    if (projects.length <= 1) return alert("Debes tener al menos un proyecto.");
    if (!window.confirm(`¿Borrar definitivamente "${activeProject.name}"?`)) return;
    const newProjects = projects.filter(p => p.id !== activeProjectId);
    setProjects(newProjects);
    setActiveProjectId(newProjects[0].id);
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`sentinel_v4.1_${activeProjectId}_`) || k.startsWith(`sentinel_v5.2_${activeProjectId}_`) || k.startsWith(`sentinel_v5.4_${activeProjectId}_`)) localStorage.removeItem(k);
    });
  };

  const updateProjectName = (newName) => {
    setProjects(projects.map(p => p.id === activeProjectId ? { ...p, name: newName } : p));
  };

  if (!activeProject) return <div className="flex items-center justify-center h-screen bg-slate-50">Cargando sistema...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 font-bold text-lg hover:text-blue-200 transition-colors">
              {activeProject?.name} <ChevronDown className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400">Gestor de Cuadrantes 24/7</p>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-72 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                      <span>Mis Servicios</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{projects.length}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {projects.map(p => (
                      <button key={p.id} onClick={() => { setActiveProjectId(p.id); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${activeProjectId === p.id ? 'bg-blue-50 text-blue-700 font-bold' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${activeProjectId === p.id ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                            {p.name}
                        </div>
                        {activeProjectId === p.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                    <button onClick={createProject} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-bold hover:bg-slate-100 text-green-600 shadow-sm transition-all hover:shadow"><FolderPlus className="w-4 h-4" /> Nuevo</button>
                    <button onClick={deleteProject} className="flex-none flex items-center justify-center px-3 py-2 bg-white border border-red-200 rounded-md text-red-500 hover:bg-red-50 hover:border-red-300 shadow-sm transition-all" title="Eliminar servicio actual"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 hidden md:block font-mono bg-slate-800 px-2 py-1 rounded">v5.8 Pro</div>
      </div>

      <Workspace 
        key={activeProjectId} 
        projectId={activeProjectId} 
        projectName={activeProject.name}
        allProjects={projects}
        // PASAMOS LAS PROPS DE INSTALACIÓN
        installPrompt={installPrompt}
        onInstall={handleInstall}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onChangeProject={setActiveProjectId}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
        onRenameProject={updateProjectName}
      />
    </div>
  );
};

export default SentinelProjectManager;