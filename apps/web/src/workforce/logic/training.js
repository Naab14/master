/* Where the team is thin, and which training would help future coverage.
 * A planning aid only: sign-off lives in the official training system. */
import { list, levelsOf } from './model';
import { teamOf } from './schedule';
import { templateFor } from './coverage';
import { addDays } from './time';

/**
 * Per team and competency: how many people can fill a position on their own
 * versus the most the team must supply on any one shift.
 */
export function skillGaps(wf, idx, date) {
  const levels = levelsOf(wf);
  const rank = id => levels.find(l => l.id === id)?.rank || 0;
  const fullRank = (levels.find(l => l.counts === 'full') || levels[0])?.rank || 1;
  const templateId = templateFor(wf, date);
  const need = new Map(); // skillId -> { count, minRank }
  for (const r of list(wf.requirements)) {
    if (r.templateId !== templateId || !r.skillId || r.kind === 'shared') continue;
    const cur = need.get(r.skillId) || { count: 0, minRank: fullRank };
    need.set(r.skillId, { count: Math.max(cur.count, r.count), minRank: Math.max(cur.minRank, rank(r.minLevelId) || fullRank) });
  }
  const out = [];
  for (const team of list(wf.teams)) {
    const members = list(wf.people).filter(p => teamOf(idx, p.id, date) === team.id && (!p.endDate || p.endDate >= date));
    if (!members.length) continue;
    for (const [skillId, n] of need) {
      const qualified = members.filter(p => rank(wf.qualifications[p.id]?.skills?.[skillId]) >= n.minRank);
      const inTraining = members.filter(p => { const r = rank(wf.qualifications[p.id]?.skills?.[skillId]); return r > 0 && r < n.minRank; });
      const planned = list(wf.trainings).filter(t => t.skillId === skillId && t.status !== 'done' && members.some(m => m.id === t.personId));
      const margin = qualified.length - n.count;
      out.push({
        teamId: team.id, skillId, required: n.count, qualified: qualified.length, margin,
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
