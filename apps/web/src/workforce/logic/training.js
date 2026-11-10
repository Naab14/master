/* Where the team is thin, and which training would help future coverage.
 * A planning aid only: sign-off lives in the official training system. */
import { list, levelsOf } from './model';
import { teamOf } from './schedule';
import { peakDemand, templateFor } from './coverage';
import { addDays, shiftMinutes } from './time';

/**
 * Per team and competency: how many people can fill a position on their own
 * versus the most the team must supply at the same moment on any one shift.
 *
 * Demand is added up across requirements that run at the same time on the
 * same shift and day (two lines each needing one inspector = two), and never
 * across different shifts or time windows that don't overlap.
 */
export function skillGaps(wf, idx, date) {
  const levels = levelsOf(wf);
  const rank = id => levels.find(l => l.id === id)?.rank || 0;
  const fullRank = (levels.find(l => l.counts === 'full') || levels[0])?.rank || 1;
  const templateId = templateFor(wf, date);
  const groups = new Map(); // `${skillId}|${shiftTypeId}|${weekday}` -> requirements
  const minRank = new Map();
  for (const r of list(wf.requirements)) {
    if (r.templateId !== templateId || !r.skillId || r.kind === 'shared' || !(r.count > 0)) continue;
    minRank.set(r.skillId, Math.max(minRank.get(r.skillId) || fullRank, rank(r.minLevelId) || fullRank));
    for (const wd of r.weekdays || [1, 2, 3, 4, 5]) {
      const k = `${r.skillId}|${r.shiftTypeId}|${wd}`;
      groups.set(k, [...(groups.get(k) || []), r]);
    }
  }
  const need = new Map(); // skillId -> peak concurrent demand
  for (const [k, reqs] of groups) {
    const [skillId, shiftTypeId] = k.split('|');
    const type = wf.shiftTypes[shiftTypeId];
    if (!type) continue;
    const { s, e } = shiftMinutes(type.start, type.end);
    need.set(skillId, Math.max(need.get(skillId) || 0, peakDemand(reqs, { startMin: s, endMin: e })));
  }
  const out = [];
  for (const team of list(wf.teams)) {
    const members = list(wf.people).filter(p => teamOf(idx, p.id, date) === team.id && (!p.endDate || p.endDate >= date));
    if (!members.length) continue;
    for (const [skillId, required] of need) {
      const min = minRank.get(skillId);
      const qualified = members.filter(p => rank(wf.qualifications[p.id]?.skills?.[skillId]) >= min);
      const inTraining = members.filter(p => { const r = rank(wf.qualifications[p.id]?.skills?.[skillId]); return r > 0 && r < min; });
      const planned = list(wf.trainings).filter(t => t.skillId === skillId && t.status !== 'done' && members.some(m => m.id === t.personId));
      const margin = qualified.length - required;
      out.push({
        teamId: team.id, skillId, required, qualified: qualified.length, margin,
        status: margin < 0 ? 'short' : margin === 0 ? 'risk' : 'met',
        candidates: [...inTraining, ...members.filter(p => !rank(wf.qualifications[p.id]?.skills?.[skillId]))].map(p => p.id),
        inTraining: inTraining.map(p => p.id), planned: planned.length,
      });
    }
  }
  return out.sort((a, b) => a.margin - b.margin);
}

export function expiringCerts(wf, date, days = 90) {
  const limit = addDays(date, days);
  const out = [];
  for (const p of list(wf.people)) {
    for (const [certId, c] of Object.entries(wf.qualifications[p.id]?.certs || {})) {
      if (c.expires && c.expires <= limit && wf.certs[certId]) out.push({ personId: p.id, certId, expires: c.expires, expired: c.expires < date });
    }
  }
  return out.sort((a, b) => a.expires.localeCompare(b.expires));
}

export const trainersFor = (wf, skillId) => {
  const levels = levelsOf(wf);
  return list(wf.people).filter(p => levels.find(l => l.id === wf.qualifications[p.id]?.skills?.[skillId])?.canSupervise).map(p => p.id);
};
