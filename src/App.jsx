import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  ShieldCheck, Trash2, UserPlus, FileText, Menu, AlertTriangle, X,
  Image as ImageIcon, FileIcon, Eraser, Settings, Calendar, Edit3,
  User, Check, Moon, Gift, Briefcase, MousePointer2, CheckSquare,
  PlusCircle, FolderPlus, FolderOpen, ChevronDown, MoreVertical,
  Thermometer, Share2, Clock, AlertCircle, Download, HelpCircle,
  UploadCloud, DownloadCloud, RefreshCw, QrCode, Layers
} from 'lucide-react';

// --- CONSTANTES ---
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FIXED_HOLIDAYS = ['1/0', '6/0', '1/4', '15/7', '12/9', '1/10', '6/11', '8/11', '25/11'];
// --- COLOR HELPERS para turnos custom (hex → inline styles) ---
const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const shiftStyleFromHex = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return {
    backgroundColor: `rgba(${r},${g},${b},0.18)`,
    color: `rgb(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)})`,
    borderColor: `rgba(${r},${g},${b},0.5)`,
  };
};
// Devuelve { cls, style } para usar en className + style
const getShiftProps = (data) => {
  if (!data) return { cls: '', style: {} };
  if (data.colorHex) return { cls: 'border', style: shiftStyleFromHex(data.colorHex) };
  return { cls: data.color || '', style: {} };
};

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
            d.querySelectorAll('button .lucide-trash-2').forEach(i => i.parentElement.remove());
            d.querySelectorAll('.truncate').forEach(t => t.classList.remove('truncate'));
            // Eliminar anillos de violación y cualquier ring de Tailwind
            d.querySelectorAll('.day-cell').forEach(c => { c.style.boxShadow = 'none'; c.style.outline = 'none'; });
            // Eliminar badges de violación (los "!" rojos)
            d.querySelectorAll('.day-cell [class*="bg-red-600"]').forEach(badge => badge.remove());
            // Eliminar SVG sueltos dentro de total-cell (Moon/Gift icons) que no renderizan bien
            d.querySelectorAll('.total-cell svg').forEach(svg => svg.remove());
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
  const [serviceHours, setServiceHours] = useState(() => loadState(K('service_hours'), {
    enabled: false, start: '08:00', end: '20:00', breaks: []
  }));
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Estados UI
  const [activeCell, setActiveCell] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [tipStep, setTipStep] = useState(() => localStorage.getItem('sentinel_tips_done') ? null : 0);
  
  const [isRenamingService, setIsRenamingService] = useState(false);
  const [tempServiceName, setTempServiceName] = useState(projectName);

  const [showInputModal, setShowInputModal] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputRole, setInputRole] = useState('VS');
  const [inputWeeklyHours, setInputWeeklyHours] = useState(40);
  const [inputMode, setInputMode] = useState('add');
  const [editingId, setEditingId] = useState(null);

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShiftCode, setNewShiftCode] = useState('');
  const [newShiftDesc, setNewShiftDesc] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftColorHex, setNewShiftColorHex] = useState('#6366f1');
  const [newShiftSplit, setNewShiftSplit] = useState(false);
  const [newShiftStart2, setNewShiftStart2] = useState('');
  const [newShiftEnd2, setNewShiftEnd2] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [saved, setSaved] = useState(false);

  // Rotación de turnos
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [rotMode, setRotMode] = useState('cycle');
  const [rotDaysOn, setRotDaysOn] = useState(4);
  const [rotDaysOff, setRotDaysOff] = useState(2);
  const [rotShift, setRotShift] = useState('');
  const [rotOffset, setRotOffset] = useState(0);
  const [rotTargetStaff, setRotTargetStaff] = useState('all');
  const [rotLcStart, setRotLcStart] = useState('larga');

  // Sincronización
  const _syncViaQr = useRef(!!new URLSearchParams(window.location.search).get('sync'));
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncCode, setSyncCode] = useState(() => {
    const urlCode = new URLSearchParams(window.location.search).get('sync');
    if (urlCode) {
      window.history.replaceState({}, '', window.location.pathname);
      return urlCode.toUpperCase();
    }
    return localStorage.getItem(`sentinel_sync_${projectId}`) || '';
  });
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | pushing | pulling | success-push | success-pull | error
  const [syncMessage, setSyncMessage] = useState('');
  const [syncLastAt, setSyncLastAt] = useState(() => localStorage.getItem(`sentinel_sync_last_${projectId}`) || '');
  const [syncServerAt, setSyncServerAt] = useState('');
  const [syncQrUrl, setSyncQrUrl] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState('');

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
  useEffect(() => localStorage.setItem(K('service_hours'), JSON.stringify(serviceHours)), [serviceHours, projectId]);
  useEffect(() => { if (serviceHours.enabled && serviceHours.start) setStartHour(serviceHours.start); }, [serviceHours.enabled, serviceHours.start]);

  // Sync — persistencia código y última sync
  useEffect(() => { if (syncCode) localStorage.setItem(`sentinel_sync_${projectId}`, syncCode); }, [syncCode, projectId]);
  useEffect(() => { if (syncLastAt) localStorage.setItem(`sentinel_sync_last_${projectId}`, syncLastAt); }, [syncLastAt, projectId]);

  // Sync — abrir modal automáticamente si la app se abrió desde un QR
  useEffect(() => {
    if (_syncViaQr.current) {
      _syncViaQr.current = false;
      setShowSyncModal(true);
      setSyncCodeInput(syncCode);
      checkSyncStatus(syncCode);
    }
  }, []);

  // Sync — generar QR cuando cambia el código
  useEffect(() => {
    if (!syncCode) { setSyncQrUrl(''); return; }
    const syncUrl = `${window.location.origin}/?sync=${syncCode}`;
    QRCode.toDataURL(syncUrl, { width: 180, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setSyncQrUrl(url))
      .catch(() => setSyncQrUrl(''));
  }, [syncCode]);

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
  const isMonday = (d) => new Date(year, month, d + 1).getDay() === 1;
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
    const currentTypes = shiftConfig[mode].types;

    if (!serviceHours.enabled) {
      // Modo 24h: comportamiento original (verificar slots requeridos)
      const requiredSlots = shiftConfig[mode].slots;
      return Array.from({ length: daysInMonth }, (_, day) => {
        const present = new Set();
        staff.forEach(s => {
          const c = currentSchedule[s.id]?.[day];
          if (currentTypes[c] || customShifts[c]) present.add(c);
        });
        const missing = requiredSlots.filter(s => !present.has(s));
        return { isComplete: missing.length === 0, missing };
      });
    }

    // Modo horario parcial: verificar cobertura de la ventana del servicio
    // Granularidad 30 min → 48 slots por día (0 = 00:00, 47 = 23:30)
    const toSlot = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 2 + (m >= 30 ? 1 : 0);
    };
    const svcStart = toSlot(serviceHours.start);
    const svcEnd   = toSlot(serviceHours.end);

    // Slots requeridos = ventana del servicio menos los descansos
    const required = new Set();
    for (let s = svcStart; s < svcEnd; s++) required.add(s);
    (serviceHours.breaks || []).forEach(br => {
      const bs = toSlot(br.start), be = toSlot(br.end);
      for (let s = bs; s < be; s++) required.delete(s);
    });

    return Array.from({ length: daysInMonth }, (_, day) => {
      const covered = new Set();
      staff.forEach(emp => {
        const code = currentSchedule[emp.id]?.[day];
        const data = currentTypes[code] || customShifts[code];
        if (!data) return;
        const shiftStart = toSlot(data.startTime || decimalToTime(data.start ?? 0));
        const shiftEnd   = shiftStart + Math.round(data.hours * 2);
        for (let s = shiftStart; s < shiftEnd; s++) covered.add(s % 48);
      });
      const missing = [...required].filter(s => !covered.has(s));
      return { isComplete: missing.length === 0, missing };
    });
  }, [currentSchedule, staff, mode, shiftConfig, daysInMonth, customShifts, serviceHours]);

  const saveCustomShift = () => {
      if (!newShiftCode || !newShiftDesc || !newShiftStart || !newShiftEnd) return;
      const startDec = timeToDecimal(newShiftStart);
      const endDec = timeToDecimal(newShiftEnd);
      const hours1 = ((endDec - startDec) + 24) % 24;
      const night1 = calculateNightHoursForShift(startDec, hours1);
      let hours = hours1;
      let nightHours = night1;
      let splitData = null;
      if (newShiftSplit && newShiftStart2 && newShiftEnd2) {
          const start2Dec = timeToDecimal(newShiftStart2);
          const end2Dec = timeToDecimal(newShiftEnd2);
          const hours2 = ((end2Dec - start2Dec) + 24) % 24;
          const night2 = calculateNightHoursForShift(start2Dec, hours2);
          hours = parseFloat((hours1 + hours2).toFixed(2));
          nightHours = parseFloat((night1 + night2).toFixed(2));
          splitData = { start: newShiftStart2, end: newShiftEnd2 };
      }
      setCustomShifts(p => ({
          ...p,
          [newShiftCode.toUpperCase()]: {
              label: newShiftDesc,
              hours,
              nightHours,
              colorHex: newShiftColorHex,
              color: '',
              desc: newShiftSplit && splitData ? `${newShiftStart}-${newShiftEnd} / ${splitData.start}-${splitData.end}` : `${newShiftStart}-${newShiftEnd}`,
              startTime: newShiftStart,
              ...(splitData ? { split: splitData } : {}),
          }
      }));
      setShowShiftModal(false);
      setNewShiftCode(''); setNewShiftDesc(''); setNewShiftStart(''); setNewShiftEnd('');
      setNewShiftSplit(false); setNewShiftStart2(''); setNewShiftEnd2('');
  };

  const deleteCustomShift = (code) => {
      if(window.confirm(`¿Eliminar turno ${code}?`)) setCustomShifts(p => { const n={...p}; delete n[code]; return n; });
  };

  const handleSaveInputName = () => {
    if (!inputName.trim()) return;
    const hoursContract = Math.round(inputWeeklyHours * 4.33);
    if (inputMode === 'add') {
        const newId = staff.length > 0 ? Math.max(...staff.map(s => s.id)) + 1 : 1;
        setStaff([...staff, { id: newId, name: inputName, hoursContract, weeklyHours: inputWeeklyHours, role: inputRole }]);
    } else {
        setStaff(staff.map(s => s.id === editingId ? { ...s, name: inputName, role: inputRole, hoursContract, weeklyHours: inputWeeklyHours } : s));
    }
    setShowInputModal(false);
  };

  const openAddEmployeeModal = () => { setInputMode('add'); setInputName(''); setInputRole('VS'); setInputWeeklyHours(40); setShowInputModal(true); };
  const openEditEmployeeModal = (employee) => { setInputMode('edit'); setInputName(employee.name); setInputRole(employee.role || 'VS'); setInputWeeklyHours(employee.weeklyHours || Math.round((employee.hoursContract || 162) / 4.33)); setEditingId(employee.id); setShowInputModal(true); };

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

  // ── SYNC ──────────────────────────────────────────────────────────────────
  const SYNC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generateSyncCode = () =>
    Array.from({ length: 6 }, () => SYNC_CHARS[Math.floor(Math.random() * SYNC_CHARS.length)]).join('');

  const timeAgo = (iso) => {
    if (!iso) return null;
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
    return `hace ${Math.floor(s / 86400)} días`;
  };

  const getSyncData = () => ({ staff, fullSchedule, customHolidays, customShifts, mode, startHour, projectName });

  const applySyncData = (data) => {
    if (data.staff)         setStaff(data.staff);
    if (data.fullSchedule)  setFullSchedule(data.fullSchedule);
    if (data.customHolidays) setCustomHolidays(data.customHolidays);
    if (data.customShifts)  setCustomShifts(data.customShifts);
    if (data.mode)          setMode(data.mode);
    if (data.startHour !== undefined) setStartHour(data.startHour);
  };

  const handleSyncPush = async () => {
    if (!syncCode) return;
    setSyncStatus('pushing');
    try {
      const res = await fetch(`/api/sync/${syncCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: getSyncData() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error servidor');
      const now = new Date().toISOString();
      setSyncLastAt(now);
      setSyncServerAt(now);
      setSyncStatus('success-push');
      setSyncMessage('Datos subidos correctamente');
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(e.message);
    }
  };

  const handleSyncPull = async () => {
    if (!syncCode) return;
    setSyncStatus('pulling');
    try {
      const res = await fetch(`/api/sync/${syncCode}`);
      if (res.status === 404) throw new Error('Código no encontrado en el servidor');
      if (!res.ok) throw new Error((await res.json()).error || 'Error servidor');
      const { data, updated_at } = await res.json();
      applySyncData(data);
      const now = new Date().toISOString();
      setSyncLastAt(now);
      setSyncServerAt(updated_at);
      setSyncStatus('success-pull');
      setSyncMessage('Datos descargados correctamente');
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(e.message);
    }
  };

  const checkSyncStatus = async (code) => {
    if (!code) return;
    try {
      const res = await fetch(`/api/sync/${code}/status`);
      if (!res.ok) return;
      const { updated_at } = await res.json();
      setSyncServerAt(updated_at);
    } catch {}
  };

  const openSyncModal = () => {
    setSyncStatus('idle');
    setSyncMessage('');
    setSyncCodeInput(syncCode);
    setShowSyncModal(true);
    checkSyncStatus(syncCode);
  };

  const serverNewerThanLocal = syncServerAt && syncLastAt && new Date(syncServerAt) > new Date(syncLastAt);
  // ─────────────────────────────────────────────────────────────────────────

  const applyRotation = () => {
      const shiftCode = rotShift || Object.keys(shiftConfig[mode].types)[0];
      setFullSchedule(prev => {
          const newFull = { ...prev };
          const monthData = { ...(newFull[monthKey] || {}) };
          const targets = rotTargetStaff === 'all' ? staff : staff.filter(s => String(s.id) === String(rotTargetStaff));

          if (rotMode === 'cycle') {
              const cycle = rotDaysOn + rotDaysOff;
              targets.forEach(s => {
                  monthData[s.id] = Array.from({ length: daysInMonth }, (_, i) => {
                      const pos = ((i - rotOffset) % cycle + cycle) % cycle;
                      return pos < rotDaysOn ? shiftCode : 'L';
                  });
              });
          } else {
              // Semana larga (L): lunes, martes, viernes, sábado, domingo → JS getDay() 1,2,5,6,0
              // Semana corta (C): miércoles, jueves → JS getDay() 3,4
              const largaDays = new Set([0, 1, 2, 5, 6]);
              const cortaDays = new Set([3, 4]);
              // Determinar índice de semana de la primera semana del mes
              const firstDay = new Date(year, month, 1);
              const firstMon = new Date(firstDay);
              firstMon.setDate(1 - ((firstDay.getDay() + 6) % 7));
              const firstWeekIdx = Math.floor(firstMon.getTime() / (7 * 24 * 60 * 60 * 1000));
              targets.forEach(s => {
                  monthData[s.id] = Array.from({ length: daysInMonth }, (_, i) => {
                      const d = new Date(year, month, i + 1);
                      const wd = d.getDay();
                      const mon = new Date(d);
                      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                      const weekIdx = Math.floor(mon.getTime() / (7 * 24 * 60 * 60 * 1000));
                      const weeksPassed = weekIdx - firstWeekIdx;
                      const isEvenWeek = weeksPassed % 2 === 0;
                      const isLarga = rotLcStart === 'larga' ? isEvenWeek : !isEvenWeek;
                      if (isLarga) return largaDays.has(wd) ? shiftCode : 'L';
                      return cortaDays.has(wd) ? shiftCode : 'L';
                  });
              });
          }

          newFull[monthKey] = monthData;
          return newFull;
      });
      setShowRotationModal(false);
  };

  const handleExportClick = (fmt) => {
      setIsExporting(true); setActiveCell(null); setIsSelectionMode(false); setShowDesktopMenu(false); setShowMobileMenu(false);
      setTimeout(() =>
          generateExport('printable-area', fmt, `Cuadrante_${projectName.replace(/\s+/g,'_')}_${MONTH_NAMES[month]}_${year}`)
              .then(() => { setIsExporting(false); setExportDone(true); setTimeout(() => setExportDone(false), 2500); }),
      800);
  };

  const gridContainerClass = isExporting ? 'grid-container inline-block' : 'inline-block min-w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden';
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

             {/* 3a. BOTÓN ROTACIÓN (MÓVIL) */}
             <button
               onClick={() => { setRotOffset(0); setRotShift(Object.keys(shiftConfig[mode].types)[0]); setShowRotationModal(true); }}
               className="md:hidden p-2 border rounded bg-white text-slate-600 border-slate-200"
               title="Plantilla de rotación"
             >
               <Calendar className="w-5 h-5" />
             </button>

             {/* 3b. BOTÓN SYNC (MÓVIL) */}
             <button
               onClick={openSyncModal}
               className={`md:hidden relative p-2 border rounded transition-colors ${serverNewerThanLocal ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-600 border-slate-200'}`}
               title="Sincronizar"
             >
               <RefreshCw className="w-5 h-5" />
               {serverNewerThanLocal && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />}
             </button>

             {/* 4. MENÚ MÓVIL (DERECHA) */}
             <div className="md:hidden relative order-3">
                <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 border rounded bg-slate-100 text-slate-600"><MoreVertical className="w-5 h-5"/></button>
                {showMobileMenu && (
                   <>
                   <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)}></div>
                   <div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-xl rounded-lg border z-[2000] overflow-hidden">
                      <div className="p-2 bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cuadrante</div>
                      <button onClick={() => { generateWhatsAppSummary(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-green-700 font-medium"><Share2 className="w-4 h-4" /> Copiar resumen WhatsApp</button>
                      <button onClick={() => { setShowShiftModal(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700"><PlusCircle className="w-4 h-4 text-purple-600" /> Crear turno personalizado</button>
                      <button onClick={() => { setRotOffset(0); setRotShift(Object.keys(shiftConfig[mode].types)[0]); setShowRotationModal(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700"><Calendar className="w-4 h-4 text-slate-600" /> Plantilla de rotación</button>
                      <button onClick={() => { setShowServiceModal(true); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 text-slate-700"><Clock className="w-4 h-4 text-slate-500" /> Horario del servicio{serviceHours.enabled && <span className="ml-auto text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{serviceHours.start}–{serviceHours.end}</span>}</button>
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

                 {/* SYNC DESKTOP */}
                 <button
                    onClick={openSyncModal}
                    title="Sincronizar cuadrante"
                    className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold border rounded transition-colors ${serverNewerThanLocal ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden lg:inline">Sync</span>
                    {serverNewerThanLocal && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />}
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
                                <button onClick={() => { setShowServiceModal(true); setShowDesktopMenu(false); }} className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 text-sm border-b border-slate-100"><Clock className="w-4 h-4 text-slate-500" /> Horario del servicio{serviceHours.enabled && <span className="ml-auto text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{serviceHours.start}–{serviceHours.end}</span>}</button>
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
                 <button onClick={() => { setRotOffset(0); setRotShift(Object.keys(shiftConfig[mode].types)[0]); setShowRotationModal(true); }} className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs bg-slate-700 text-white rounded shadow hover:bg-slate-600 font-bold" title="Plantilla de rotación">
                    <Calendar className="w-4 h-4" />
                    <span className="hidden lg:inline">Rotación</span>
                 </button>
             </div>
          </div>
      </div>

      <div className="bg-white px-4 py-2 flex justify-between items-center border-b-2 border-slate-100 shadow-sm">
         <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg overflow-hidden shadow">
               <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-700 transition-colors">&lt;</button>
               <span className="px-3 py-1.5 text-sm font-bold text-white w-36 text-center tracking-wide">{MONTH_NAMES[month]} {year}</span>
               <button onClick={() => changeMonth(1)} className="px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-700 transition-colors">&gt;</button>
            </div>
            {(month !== new Date().getMonth() || year !== new Date().getFullYear()) && (
               <button onClick={() => { setCurrentDate(new Date()); setActiveCell(null); setIsSelectionMode(false); setSelectedCells(new Set()); setLastSelectedCell(null); }} className="px-2.5 py-1.5 text-xs font-bold bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors" title="Ir al mes actual">Hoy</button>
            )}
         </div>
         <div className="flex items-center gap-3">
            {!serviceHours.enabled && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <input
                      type="time"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="text-xs font-mono outline-none text-slate-700 bg-transparent w-16"
                  />
              </div>
            )}
            <div className="flex bg-slate-800 rounded-lg overflow-hidden shadow">
                {['8H', '12H'].map(m => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${mode === m ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{m}</button>)}
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-200" id="scroll-container">
        <div id="printable-area" className={gridContainerClass}>
            <div className="mb-6 border-b-2 border-slate-800 pb-4 hidden" style={{ display: isExporting ? 'block' : 'none' }}>
                <div className="flex justify-between items-end">
                    <div><h1 className="text-3xl font-bold uppercase">Cuadrante Mensual</h1><p className="text-xl text-slate-600">{projectName}</p></div>
                    <div className="text-right header-info-right"><p className="text-2xl font-bold text-blue-900 uppercase">{MONTH_NAMES[month]} {year}</p><p className="text-xs font-mono">MODO: {mode} | INICIO: {startHour}</p></div>
                </div>
            </div>

            <div className={isExporting ? 'flex grid-row bg-slate-100' : 'flex border-b-2 border-slate-700 h-10 bg-slate-800'}>
                <div className={isExporting ? 'name-cell font-bold text-slate-600 text-[10px] uppercase bg-slate-100' : 'w-32 md:w-48 shrink-0 flex items-center justify-center border-r border-slate-700 sticky left-0 z-10 bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]'}>
                    <User className="w-4 h-4 text-slate-400" />
                </div>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                    <div key={i} onClick={() => toggleHoliday(i)}
                        className={`${isExporting ? 'day-cell text-[10px] font-bold' : `w-9 shrink-0 flex items-center justify-center border-r border-slate-700 cursor-pointer transition-colors${isMonday(i) && i > 0 ? ' border-l-2 border-l-slate-500' : ''}`}
                        ${isExporting
                            ? (isHoliday(i) ? 'bg-red-100 text-red-700' : (isWeekend(i) ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400'))
                            : (isHoliday(i) ? 'bg-red-700 text-red-100 hover:bg-red-600' : (isWeekend(i) ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'))
                        }`}>
                        <span className="text-[10px] font-bold">{i + 1}</span>
                    </div>
                ))}
                <div className={isExporting ? 'total-cell font-bold text-[9px] bg-white' : 'w-24 md:w-28 shrink-0 flex items-center justify-center sticky right-0 z-10 bg-slate-800 text-slate-300 border-l border-slate-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.4)] text-[10px] font-bold'}>Total</div>
            </div>

            {staff.map((emp, empIdx) => {
                const stats = calculateStats(emp.id);
                const overtime = Math.max(0, Math.round((stats.total - emp.hoursContract) * 10) / 10);
                const hClass = stats.total > emp.hoursContract ? 'text-red-500 font-bold' : (stats.total < emp.hoursContract - 12 ? 'text-amber-500' : 'text-emerald-600');
                const rowBg = empIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                return (
                    <div key={emp.id} className={isExporting ? 'flex grid-row' : `flex border-b border-slate-100 h-12 md:h-11 group ${rowBg}`}>
                        <div className={isExporting ? 'name-cell text-sm font-bold text-slate-900 bg-white' : `w-32 md:w-48 shrink-0 px-2 flex flex-col justify-center sticky left-0 z-10 ${rowBg} border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] cursor-pointer hover:bg-blue-50 transition-colors`} onClick={() => handleRowSelect(emp.id)}>
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

                            const shiftSp = isValid ? getShiftProps(data) : null;
                            const colorCls = shiftSp?.cls || '';
                            const colorStyle = (borderClass === '' && shiftSp?.style) ? shiftSp.style : {};
                            const mondaySep = !isExporting && isMonday(d) && d > 0 ? 'border-l-2 border-l-slate-300' : '';
                            const baseClass = isExporting
                                ? `day-cell text-[10px] font-bold ${isValid ? colorCls : (holiday ? 'bg-red-100 text-red-700' : (wknd ? 'bg-slate-300' : ''))}`
                                : `w-9 shrink-0 flex items-center justify-center border-r border-slate-100 text-[10px] md:text-xs font-bold transition-all relative ${holiday && !isValid ? 'bg-red-100 text-red-700' : ''} ${wknd && !isValid && !holiday ? 'bg-slate-300 text-slate-700' : ''} ${isValid ? colorCls : (data ? '' : 'bg-slate-50 text-slate-300 line-through')} active:scale-95 ${borderClass} ${violationClass} ${mondaySep}`;

                            return (
                                <button
                                    key={d}
                                    onClick={(e) => handleCellClick(e, emp.id, d)}
                                    className={baseClass}
                                    style={colorStyle}
                                    title={violation ? `Descanso insuficiente` : ''}
                                >
                                    {shift !== 'L' && shift}
                                    {violation && !isExporting && !isSel && <div className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-bl-lg flex items-center justify-center shadow-sm"><span className="text-[8px] text-white font-bold">!</span></div>}
                                </button>
                            );
                        })}
                        <div className={isExporting ? 'total-cell bg-white' : `w-24 md:w-28 shrink-0 flex flex-col justify-center items-start px-2 gap-0.5 sticky right-0 z-10 ${rowBg} border-l border-slate-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.06)]`}>
                            {isExporting ? (
                                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',padding:'4px 6px'}}>
                                    <span style={{fontWeight:'900',fontSize:'14px',color: stats.total > emp.hoursContract ? '#dc2626' : stats.total < emp.hoursContract - 12 ? '#d97706' : '#16a34a'}}>
                                        T: {stats.total}h
                                    </span>
                                    <span style={{fontSize:'9px',color:'#64748b',display:'flex',gap:'8px'}}>
                                        <span>🌙 {stats.night}</span>
                                        <span>🎁 {stats.festive}</span>
                                    </span>
                                </div>
                            ) : (
                                <>
                                  <div className="flex items-baseline gap-1 w-full">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Hrs</span>
                                    <span className={`text-sm font-bold leading-none ${hClass}`}>{stats.total}</span>
                                    <span className="text-[9px] text-slate-300">/{emp.hoursContract}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {overtime > 0
                                      ? <span className="flex items-center gap-0.5 text-[9px] text-red-500 font-bold">+{overtime}h ext.</span>
                                      : <span className="flex items-center gap-0.5 text-[9px] text-slate-400"><Moon className="w-2.5 h-2.5" />{stats.night}</span>
                                    }
                                    <span className="flex items-center gap-0.5 text-[9px] text-slate-400"><Gift className="w-2.5 h-2.5" />{stats.festive}</span>
                                  </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {!isExporting && staff.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                <UserPlus className="w-12 h-12 opacity-30" />
                <div className="text-center">
                  <p className="font-bold text-slate-600">Sin personal asignado</p>
                  <p className="text-sm mt-1">Pulsa <span className="font-bold text-blue-600">Alta</span> para añadir a alguien al cuadrante</p>
                </div>
              </div>
            )}

            {!isExporting && (
            <div className="flex border-t border-slate-200 bg-slate-800 h-7">
                <div className="w-32 md:w-48 shrink-0 px-3 text-[9px] font-bold uppercase text-slate-400 border-r border-slate-700 flex items-center sticky left-0 z-10 bg-slate-800 tracking-widest">
                    Cobertura
                </div>
                {dailyCoverageStatus.map((status, i) => (
                    <div key={i} className={`w-9 shrink-0 flex items-center justify-center border-r border-slate-700 text-[8px] font-bold ${status.isComplete ? 'text-emerald-400 bg-slate-800' : 'text-red-300 bg-slate-800'}`}>
                        {status.isComplete ? '✓' : '!'}
                    </div>
                ))}
                <div className="w-24 md:w-28 shrink-0 border-l border-slate-700 sticky right-0 bg-slate-800"></div>
            </div>
            )}

            <div className={`mt-8 px-8 pt-4 border-t border-slate-200 ${isExporting ? 'block' : 'hidden'}`}>
                <div className="text-[10px] text-slate-500 flex flex-wrap gap-4 mt-8">
                  <span className="font-bold uppercase text-slate-700">Leyenda:</span>
                  {Object.entries(shiftConfig[mode].types).map(([c, d]) => (<span key={c} className="flex items-center gap-1"><span className="font-bold border border-slate-300 px-1 bg-white text-slate-800 legend-square">{c}</span><span>{d.label} <span className="text-slate-400 font-mono ml-1">({d.desc})</span></span></span>))}
                  {Object.entries(customShifts).map(([c, d]) => { const sp = getShiftProps(d); return (<span key={c} className="flex items-center gap-1"><span className={`font-bold border px-1 legend-square ${sp.cls}`} style={sp.style}>{c}</span><span>{d.label} <span className="text-slate-400 font-mono ml-1">({d.desc})</span></span></span>); })}
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
                    {Object.entries(customShifts).map(([c, d]) => { const sp = getShiftProps(d); return (
                        <button key={c} onClick={() => applyMultiShift(c)} className={`px-3 py-2 rounded border flex flex-col items-center justify-center min-w-[3.5rem] transition-transform active:scale-95 ${sp.cls}`} style={sp.style}>
                            <span className="font-bold">{c}</span>
                            <span className="text-[9px] whitespace-nowrap">{d.desc}</span>
                        </button>
                    ); })}
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
        <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
                    <h3 className="font-bold text-base">{inputMode === 'add' ? 'Nuevo personal' : 'Editar datos'}</h3>
                    <button onClick={() => setShowInputModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre</label>
                            <input autoFocus value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Nombre completo"
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rol</label>
                            <input value={inputRole} onChange={e => setInputRole(e.target.value.toUpperCase())} placeholder="VS"
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-bold text-center focus:outline-none focus:ring-2 focus:ring-slate-400" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Jornada semanal</label>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5">
                                <input type="number" min="1" max="40" value={inputWeeklyHours}
                                    onChange={e => setInputWeeklyHours(Math.max(1, Math.min(40, Number(e.target.value))))}
                                    className="w-12 text-lg font-bold text-center bg-transparent outline-none text-slate-800" />
                                <span className="text-sm text-slate-500">h / semana</span>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs text-slate-400">≈ mensual</p>
                                <p className="text-sm font-bold text-slate-700">{Math.round(inputWeeklyHours * 4.33)}h</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                            {[20, 30, 35, 40].map(h => (
                                <button key={h} onClick={() => setInputWeeklyHours(h)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${inputWeeklyHours === h ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                    {h}h
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
                    <button onClick={() => setShowInputModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancelar</button>
                    <button onClick={handleSaveInputName} disabled={!inputName.trim()}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40">Guardar</button>
                </div>
            </div>
        </div>
      )}

      {showShiftModal && (() => {
          const startDec = newShiftStart ? timeToDecimal(newShiftStart) : null;
          const endDec = newShiftEnd ? timeToDecimal(newShiftEnd) : null;
          const dur1 = (startDec !== null && endDec !== null) ? ((endDec - startDec + 24) % 24) : 0;
          const start2Dec = newShiftSplit && newShiftStart2 ? timeToDecimal(newShiftStart2) : null;
          const end2Dec = newShiftSplit && newShiftEnd2 ? timeToDecimal(newShiftEnd2) : null;
          const dur2 = (start2Dec !== null && end2Dec !== null) ? ((end2Dec - start2Dec + 24) % 24) : 0;
          const durationHours = dur1 + dur2;
          const durationH = Math.floor(durationHours);
          const durationM = Math.round((durationHours - durationH) * 60);
          const night1 = (startDec !== null && dur1 > 0) ? calculateNightHoursForShift(startDec, dur1) : 0;
          const night2 = (start2Dec !== null && dur2 > 0) ? calculateNightHoursForShift(start2Dec, dur2) : 0;
          const nightH = parseFloat((night1 + night2).toFixed(2));
          const previewStyle = shiftStyleFromHex(newShiftColorHex);
          const hasAll = newShiftCode && newShiftStart && newShiftEnd;
          const QUICK_COLORS = ['#6366f1','#f97316','#10b981','#f43f5e','#8b5cf6','#0ea5e9','#eab308','#14b8a6','#ec4899','#64748b'];
          return (
          <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base">Nuevo turno</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Personaliza y previsualiza antes de guardar</p>
                </div>
                <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Preview en vivo */}
                <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="w-14 h-14 rounded-xl border-2 flex items-center justify-center font-bold text-xl shrink-0"
                    style={previewStyle}>
                    {newShiftCode || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{newShiftDesc || 'Nombre del turno'}</p>
                    {hasAll ? (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {newShiftStart} → {newShiftEnd}
                        {newShiftSplit && newShiftStart2 && newShiftEnd2 && ` / ${newShiftStart2} → ${newShiftEnd2}`}
                        {' · '}{durationH > 0 ? `${durationH}h` : ''}{durationM > 0 ? ` ${durationM}min` : ''}
                        {nightH > 0 ? ` · 🌙 ${nightH}h` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">Completa los campos para ver el preview</p>
                    )}
                  </div>
                </div>

                {/* Código + Nombre */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Código</label>
                    <input maxLength={2} value={newShiftCode} onChange={e => setNewShiftCode(e.target.value.toUpperCase())}
                      placeholder="M7"
                      className="w-full p-2.5 border border-slate-300 rounded-lg uppercase font-bold text-center text-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre</label>
                    <input value={newShiftDesc} onChange={e => setNewShiftDesc(e.target.value)}
                      placeholder="Ej: Mañana larga"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  </div>
                </div>

                {/* Horario: entrada → salida */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Horario</label>
                    <button
                      onClick={() => { setNewShiftSplit(!newShiftSplit); if(newShiftSplit){ setNewShiftStart2(''); setNewShiftEnd2(''); }}}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${newShiftSplit ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                    >
                      <Layers className="w-3 h-3" />
                      Jornada partida
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">{newShiftSplit ? 'Entrada 1ª parte' : 'Entrada'}</p>
                        <input type="time" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">{newShiftSplit ? 'Salida 1ª parte' : 'Salida'}</p>
                        <input type="time" value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      </div>
                    </div>
                    {newShiftSplit && (
                      <>
                        <div className="flex items-center gap-2 text-[10px] text-amber-600 font-medium py-1">
                          <div className="flex-1 border-t border-dashed border-amber-300" />
                          <span>Descanso</span>
                          <div className="flex-1 border-t border-dashed border-amber-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Entrada 2ª parte</p>
                            <input type="time" value={newShiftStart2} onChange={e => setNewShiftStart2(e.target.value)}
                              className="w-full p-2.5 border border-amber-300 rounded-lg text-sm bg-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">Salida 2ª parte</p>
                            <input type="time" value={newShiftEnd2} onChange={e => setNewShiftEnd2(e.target.value)}
                              className="w-full p-2.5 border border-amber-300 rounded-lg text-sm bg-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {hasAll && durationHours > 0 && (
                    <div className="mt-2 flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <span className="font-bold text-slate-700">
                        {durationH > 0 ? `${durationH}h` : ''}{durationM > 0 ? ` ${durationM}min` : ''}
                      </span>
                      {newShiftSplit && dur2 > 0 && <span className="text-amber-600 font-medium">Jornada partida ({Math.floor(dur1)}h + {Math.floor(dur2)}h)</span>}
                      {nightH > 0 && <span className="text-indigo-600 font-medium">🌙 {nightH}h nocturnas (auto)</span>}
                    </div>
                  )}
                </div>

                {/* Color libre */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Color</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="relative cursor-pointer shrink-0">
                      <input type="color" value={newShiftColorHex} onChange={e => setNewShiftColorHex(e.target.value)}
                        className="sr-only" />
                      <div className="w-10 h-10 rounded-xl border-2 border-slate-300 shadow-inner flex items-center justify-center text-xs font-bold overflow-hidden"
                        style={{ background: newShiftColorHex }}>
                      </div>
                    </label>
                    <span className="text-sm font-mono text-slate-600">{newShiftColorHex.toUpperCase()}</span>
                    <div className="flex gap-1.5 flex-wrap ml-auto">
                      {QUICK_COLORS.map(c => (
                        <button key={c} onClick={() => setNewShiftColorHex(c)}
                          style={{ background: c }}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newShiftColorHex === c ? 'border-slate-800 scale-110' : 'border-white shadow'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Turnos existentes */}
                {Object.keys(customShifts).length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mis turnos</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(customShifts).map(([code, data]) => {
                        const sp = getShiftProps(data);
                        return (
                          <div key={code} className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border text-xs font-bold ${sp.cls}`} style={sp.style}>
                            <span>{code}</span>
                            <span className="font-normal opacity-70">{data.label}</span>
                            <button onClick={() => deleteCustomShift(code)} className="ml-0.5 opacity-50 hover:opacity-100">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowShiftModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancelar</button>
                <button onClick={saveCustomShift}
                  disabled={!newShiftCode || !newShiftDesc || !newShiftStart || !newShiftEnd}
                  className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Guardar turno
                </button>
              </div>
            </div>
          </div>
          );
      })()}
      
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
                  {Object.entries(customShifts).map(([c, d]) => { const sp = getShiftProps(d); return (
                     <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`p-2 border rounded flex flex-col items-center justify-center transition-transform hover:scale-105 ${sp.cls}`} style={sp.style}>
                       <span className="font-bold text-lg">{c}</span>
                       <span className="text-[10px] font-medium opacity-80">{d.desc}</span>
                    </button>
                  ); })}
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
                     {Object.entries(customShifts).map(([c, d]) => { const sp = getShiftProps(d); return (
                       <button key={c} onClick={() => setShift(activeCell.staffId, activeCell.dayIndex, c)} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-transform active:scale-95 ${sp.cls}`} style={sp.style}>
                         <span className="text-2xl font-bold">{c}</span><span className="text-[10px] opacity-70 mt-1">{d.desc}</span>
                       </button>
                     ); })}
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

      {/* ── MODAL DE ROTACIÓN ─────────────────────────────────────── */}
      {showRotationModal && (() => {
          const cycle = rotDaysOn + rotDaysOff;
          const activeShift = rotShift || Object.keys(shiftConfig[mode].types)[0];
          const allShifts = { ...shiftConfig[mode].types, ...customShifts };
          const presets = [
              { label: '4×2', on: 4, off: 2 }, { label: '3×3', on: 3, off: 3 },
              { label: '5×2', on: 5, off: 2 }, { label: '6×3', on: 6, off: 3 },
              { label: '2×2', on: 2, off: 2 }, { label: '7×7', on: 7, off: 7 },
          ];
          const largaDays = new Set([0, 1, 2, 5, 6]); // JS: 0=Dom,1=Lun,2=Mar,5=Vie,6=Sáb
          const cortaDays = new Set([3, 4]); // 3=Mié,4=Jue
          const DAY_LETTERS = ['D','L','M','X','J','V','S'];
          const firstDay = new Date(year, month, 1);
          const firstMon = new Date(firstDay);
          firstMon.setDate(1 - ((firstDay.getDay() + 6) % 7));
          const firstWeekIdx = Math.floor(firstMon.getTime() / (7 * 24 * 60 * 60 * 1000));
          const getLcWeekType = (i) => {
              const d = new Date(year, month, i + 1);
              const mon = new Date(d);
              mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
              const wIdx = Math.floor(mon.getTime() / (7 * 24 * 60 * 60 * 1000));
              const isEven = (wIdx - firstWeekIdx) % 2 === 0;
              return (rotLcStart === 'larga' ? isEven : !isEven) ? 'larga' : 'corta';
          };
          return (
          <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
              {/* Cabecera */}
              <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base">Plantilla de Rotación</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Aplica un patrón automático al cuadrante</p>
                </div>
                <button onClick={() => setShowRotationModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>

              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Selector de modo */}
                <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm font-bold">
                  <button onClick={() => setRotMode('cycle')}
                    className={`flex-1 py-2.5 transition-colors ${rotMode === 'cycle' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    Ciclo fijo
                  </button>
                  <button onClick={() => setRotMode('semana-lc')}
                    className={`flex-1 py-2.5 transition-colors border-l border-slate-200 ${rotMode === 'semana-lc' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    Sem. Larga · Corta
                  </button>
                </div>

                {rotMode === 'cycle' ? (<>
                  {/* Presets rápidos */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Presets rápidos</p>
                    <div className="flex gap-2 flex-wrap">
                      {presets.map(p => (
                        <button key={p.label} onClick={() => { setRotDaysOn(p.on); setRotDaysOff(p.off); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${rotDaysOn === p.on && rotDaysOff === p.off ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Configuración manual */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Días trabajando</label>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setRotDaysOn(d => Math.max(1, d - 1))} className="w-8 h-8 rounded-md bg-white shadow text-slate-700 font-bold text-lg hover:bg-slate-50">−</button>
                        <span className="flex-1 text-center font-bold text-slate-800 text-lg">{rotDaysOn}</span>
                        <button onClick={() => setRotDaysOn(d => Math.min(28, d + 1))} className="w-8 h-8 rounded-md bg-white shadow text-slate-700 font-bold text-lg hover:bg-slate-50">+</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Días libres</label>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setRotDaysOff(d => Math.max(1, d - 1))} className="w-8 h-8 rounded-md bg-white shadow text-slate-700 font-bold text-lg hover:bg-slate-50">−</button>
                        <span className="flex-1 text-center font-bold text-slate-800 text-lg">{rotDaysOff}</span>
                        <button onClick={() => setRotDaysOff(d => Math.min(28, d + 1))} className="w-8 h-8 rounded-md bg-white shadow text-slate-700 font-bold text-lg hover:bg-slate-50">+</button>
                      </div>
                    </div>
                  </div>
                </>) : (<>
                  {/* Info semana larga/corta */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 shrink-0 mt-0.5">Sem. Larga</span>
                      <span className="text-xs text-slate-700 font-medium">Lun · Mar · Vie · Sáb · Dom</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 shrink-0 mt-0.5">Sem. Corta</span>
                      <span className="text-xs text-slate-700 font-medium">Mié · Jue</span>
                    </div>
                  </div>

                  {/* Qué semana empieza el mes */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Primera semana del mes es…
                    </p>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm font-bold">
                      <button onClick={() => setRotLcStart('larga')}
                        className={`flex-1 py-2 transition-colors ${rotLcStart === 'larga' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                        Larga
                      </button>
                      <button onClick={() => setRotLcStart('corta')}
                        className={`flex-1 py-2 transition-colors border-l border-slate-200 ${rotLcStart === 'corta' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                        Corta
                      </button>
                    </div>
                  </div>
                </>)}

                {/* Turno a asignar */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Turno a asignar</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(allShifts).map(([c, d]) => { const sp = getShiftProps(d); return (
                      <button key={c} onClick={() => setRotShift(c)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${sp.cls} ${activeShift === c ? 'ring-2 ring-offset-1 ring-slate-700 scale-105' : 'opacity-70 hover:opacity-100'}`}
                        style={sp.style}>
                        {c} <span className="font-normal opacity-70">{d.desc}</span>
                      </button>
                    ); })}
                  </div>
                </div>

                {/* Empleado destino */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Aplicar a</p>
                  <select value={rotTargetStaff} onChange={e => setRotTargetStaff(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 font-medium">
                    <option value="all">Todos los empleados</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Preview + controles de ajuste (solo en modo cycle) */}
                <div>
                  {rotMode === 'cycle' && (
                    <>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ajustar inicio del ciclo
                        <span className="normal-case text-slate-400 font-normal ml-1">(desplaza el patrón día a día)</span>
                      </p>
                      <div className="flex items-center gap-3 mb-3">
                        <button onClick={() => setRotOffset(o => o - 1)} className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold text-xl hover:bg-slate-700 flex items-center justify-center">‹</button>
                        <div className="flex-1 text-center">
                          <span className="text-2xl font-bold text-slate-800">{rotOffset >= 0 ? `+${rotOffset}` : rotOffset}</span>
                          <span className="text-xs text-slate-400 ml-1">días</span>
                        </div>
                        <button onClick={() => setRotOffset(o => o + 1)} className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold text-xl hover:bg-slate-700 flex items-center justify-center">›</button>
                        <button onClick={() => setRotOffset(0)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200">Reset</button>
                      </div>
                    </>
                  )}

                  {/* Preview interactivo — scroll horizontal */}
                  <p className="text-[10px] text-slate-400 mb-1.5">Vista previa del mes ({MONTH_NAMES[month]})</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <div className="flex min-w-max">
                      {Array.from({ length: daysInMonth }, (_, i) => {
                          const shiftData = allShifts[activeShift];
                          const wknd = isWeekend(i);
                          const holiday = isHoliday(i);
                          const wd = new Date(year, month, i + 1).getDay();
                          let isWorking;
                          let weekLabel = null;
                          if (rotMode === 'cycle') {
                              const pos = ((i - rotOffset) % cycle + cycle) % cycle;
                              isWorking = pos < rotDaysOn;
                          } else {
                              const wType = getLcWeekType(i);
                              isWorking = wType === 'larga' ? largaDays.has(wd) : cortaDays.has(wd);
                              weekLabel = wType === 'larga' ? 'L' : 'C';
                          }
                          return (
                            <div key={i} className="flex flex-col items-center w-9 shrink-0">
                              <div className={`w-full h-6 flex items-center justify-center text-[9px] font-bold border-r border-b ${holiday ? 'bg-red-700 text-white' : wknd ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                {i + 1}
                              </div>
                              {rotMode === 'semana-lc' && (
                                <div className={`w-full h-4 flex items-center justify-center text-[8px] font-bold border-r border-b border-slate-100 ${weekLabel === 'L' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                  {DAY_LETTERS[wd]}
                                </div>
                              )}
                              {(() => { const sp = isWorking && shiftData ? getShiftProps(shiftData) : null; return (
                              <div className={`w-full h-8 flex items-center justify-center text-[10px] font-bold border-r border-b border-slate-100 ${isWorking ? (sp?.cls || 'bg-blue-100 text-blue-800') : 'bg-white text-slate-200'}`}
                                style={isWorking ? (sp?.style || {}) : {}}>
                                {isWorking ? activeShift : ''}
                              </div>
                              ); })()}
                            </div>
                          );
                      })}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">
                    {rotMode === 'cycle' ? 'Desliza para ver el mes completo · Usa ‹ › para ajustar' : 'Desliza para ver el mes completo · Amarillo = sem. larga · Azul = sem. corta'}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowRotationModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancelar</button>
                <button onClick={applyRotation} className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700">
                  Aplicar plantilla
                </button>
              </div>
            </div>
          </div>
          );
      })()}

      {/* ── MODAL HORARIO DE SERVICIO ─────────────────────────────────────── */}
      {showServiceModal && (() => {
        const addBreak = () => setServiceHours(p => ({ ...p, breaks: [...(p.breaks||[]), { start: '13:00', end: '14:00' }] }));
        const removeBreak = (i) => setServiceHours(p => ({ ...p, breaks: p.breaks.filter((_, j) => j !== i) }));
        const updateBreak = (i, field, val) => setServiceHours(p => ({ ...p, breaks: p.breaks.map((b, j) => j === i ? { ...b, [field]: val } : b) }));
        const fmtWindow = () => {
          if (!serviceHours.enabled) return '24h';
          let s = `${serviceHours.start}–${serviceHours.end}`;
          if (serviceHours.breaks?.length) s += ` (${serviceHours.breaks.length} descanso${serviceHours.breaks.length > 1 ? 's' : ''})`;
          return s;
        };
        return (
        <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Horario del servicio</h3>
                <p className="text-xs text-slate-400 mt-0.5">Define la ventana de cobertura del servicio</p>
              </div>
              <button onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Toggle 24h / parcial */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm font-bold">
                <button onClick={() => setServiceHours(p => ({ ...p, enabled: false }))}
                  className={`flex-1 py-2.5 transition-colors ${!serviceHours.enabled ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  Servicio 24h
                </button>
                <button onClick={() => setServiceHours(p => ({ ...p, enabled: true }))}
                  className={`flex-1 py-2.5 transition-colors border-l border-slate-200 ${serviceHours.enabled ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  Horario parcial
                </button>
              </div>

              {serviceHours.enabled && (<>
                {/* Ventana principal */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ventana del servicio</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Inicio</p>
                      <input type="time" value={serviceHours.start}
                        onChange={e => setServiceHours(p => ({ ...p, start: e.target.value }))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Fin</p>
                      <input type="time" value={serviceHours.end}
                        onChange={e => setServiceHours(p => ({ ...p, end: e.target.value }))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Descansos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descansos / pausas</p>
                    <button onClick={addBreak} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200">+ Añadir</button>
                  </div>
                  {(!serviceHours.breaks || serviceHours.breaks.length === 0) && (
                    <p className="text-xs text-slate-400 italic">Sin descansos — el servicio corre sin interrupción</p>
                  )}
                  <div className="space-y-2">
                    {(serviceHours.breaks || []).map((br, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">Descanso {i + 1}</span>
                        <input type="time" value={br.start} onChange={e => updateBreak(i, 'start', e.target.value)}
                          className="flex-1 p-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-slate-400" />
                        <span className="text-slate-400 text-xs">→</span>
                        <input type="time" value={br.end} onChange={e => updateBreak(i, 'end', e.target.value)}
                          className="flex-1 p-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-slate-400" />
                        <button onClick={() => removeBreak(i)} className="text-red-400 hover:text-red-600 shrink-0"><X className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cobertura requerida</p>
                  <p className="text-sm font-bold text-slate-800">{fmtWindow()}</p>
                  <p className="text-xs text-slate-400 mt-1">El indicador ✓/! del cuadrante verificará esta ventana horaria</p>
                </div>
              </>)}

              {!serviceHours.enabled && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-sm font-bold text-slate-800">Cobertura 24h</p>
                  <p className="text-xs text-slate-400 mt-1">Se verificará que todos los turnos del sistema estén cubiertos cada día</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <button onClick={() => setShowServiceModal(false)}
                className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700">
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── MODAL SYNC ────────────────────────────────────────────────────── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Sincronización</h3>
                <p className="text-xs text-slate-400 mt-0.5">Comparte el cuadrante entre dispositivos</p>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Código */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Código del proyecto</p>
                <div className="flex gap-2">
                  <input
                    value={syncCodeInput}
                    onChange={e => setSyncCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))}
                    placeholder="ABC123"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-lg text-center tracking-widest text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    onClick={() => { const c = generateSyncCode(); setSyncCodeInput(c); setSyncCode(c); }}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 border border-slate-200 whitespace-nowrap"
                    title="Generar código nuevo"
                  >Nuevo</button>
                  {syncCodeInput.length === 6 && syncCodeInput !== syncCode && (
                    <button
                      onClick={() => { setSyncCode(syncCodeInput); checkSyncStatus(syncCodeInput); }}
                      className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700"
                    >Usar</button>
                  )}
                </div>
                {!syncCode && <p className="text-[10px] text-slate-400 mt-1.5">Genera un código nuevo o introduce uno existente para sincronizar</p>}
              </div>

              {/* QR + estado */}
              {syncCode && (
                <div className="flex gap-4 items-start">
                  {syncQrUrl
                    ? <img src={syncQrUrl} alt="QR sync" className="w-24 h-24 rounded-lg border border-slate-200 shrink-0" />
                    : <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0"><QrCode className="w-8 h-8 text-slate-300"/></div>
                  }
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">Código: <span className="font-mono tracking-widest">{syncCode}</span></p>
                    <p className="text-[11px] text-slate-400 leading-snug">Escanea el QR con el móvil o introduce el código manualmente en el otro dispositivo</p>
                    {syncLastAt && <p className="text-[10px] text-slate-400">Última sync: <span className="text-slate-600 font-medium">{timeAgo(syncLastAt)}</span></p>}
                    {serverNewerThanLocal && (
                      <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/>
                        El servidor tiene cambios más recientes
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Estado de la operación */}
              {syncStatus !== 'idle' && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  syncStatus === 'pushing' || syncStatus === 'pulling' ? 'bg-slate-100 text-slate-600' :
                  syncStatus === 'success-push' || syncStatus === 'success-pull' ? 'bg-green-50 text-green-700 border border-green-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {(syncStatus === 'pushing' || syncStatus === 'pulling') && <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0"/>}
                  {(syncStatus === 'success-push' || syncStatus === 'success-pull') && <Check className="w-4 h-4 shrink-0"/>}
                  {syncStatus === 'error' && <AlertTriangle className="w-4 h-4 shrink-0"/>}
                  <span>{
                    syncStatus === 'pushing' ? 'Subiendo datos al servidor…' :
                    syncStatus === 'pulling' ? 'Descargando datos del servidor…' :
                    syncMessage
                  }</span>
                </div>
              )}

              {/* Acciones */}
              {syncCode && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSyncPush}
                    disabled={syncStatus === 'pushing' || syncStatus === 'pulling'}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 disabled:opacity-40"
                  >
                    <UploadCloud className="w-4 h-4"/>Subir
                  </button>
                  <button
                    onClick={handleSyncPull}
                    disabled={syncStatus === 'pushing' || syncStatus === 'pulling'}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-40 ${serverNewerThanLocal ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <DownloadCloud className="w-4 h-4"/>Bajar
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100">
              <button onClick={() => setShowSyncModal(false)} className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cerrar</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ONBOARDING TIPS */}
      {tipStep !== null && (() => {
        const tips = [
          { title: 'Añade personal', body: 'Pulsa el botón azul "Alta" para dar de alta a los empleados del servicio.', arrow: 'top-right' },
          { title: 'Asigna turnos', body: 'Toca cualquier celda del cuadrante para asignar o cambiar el turno de ese día.', arrow: 'center' },
          { title: 'Plantilla de rotación', body: 'Usa el icono de calendario para aplicar automáticamente un patrón de rotación a todo el mes.', arrow: 'top-right' },
          { title: 'Sincroniza con el móvil', body: 'Pulsa el botón de sync y escanea el QR desde el móvil para trabajar en ambos dispositivos.', arrow: 'top-right' },
        ];
        const tip = tips[tipStep];
        const isLast = tipStep === tips.length - 1;
        const dismiss = () => { localStorage.setItem('sentinel_tips_done', '1'); setTipStep(null); };
        return (
          <div className="fixed inset-0 z-[3500] pointer-events-none">
            <div className="pointer-events-auto fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm">
              <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                  <div className="flex gap-1">
                    {tips.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all ${i === tipStep ? 'w-6 bg-blue-400' : i < tipStep ? 'w-2 bg-slate-500' : 'w-2 bg-slate-700'}`} />
                    ))}
                  </div>
                  <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 text-xs">Omitir</button>
                </div>
                <div className="px-4 py-3">
                  <p className="font-bold text-sm text-white">{tip.title}</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{tip.body}</p>
                </div>
                <div className="px-4 pb-4 flex justify-end">
                  {isLast
                    ? <button onClick={dismiss} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-xl">Empezar</button>
                    : <button onClick={() => setTipStep(tipStep + 1)} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-xl">Siguiente →</button>
                  }
                </div>
              </div>
            </div>
          </div>
        );
      })()}
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