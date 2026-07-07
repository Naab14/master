import { PROCESSES } from './data';

/**
 * Calculate weekly coverage across all processes intelligently.
 * Operators with one cert get assigned first.
 * Multi-certified operators get assigned dynamically to the process with the highest need.
 */
export function getAllCoverageForWeek(operators, vacationBlocks, demand, week, shiftMode, shiftFilter, holidayMap) {
  const coverageMap = {};
  
  // Initialize map
  PROCESSES.forEach(proc => {
    coverageMap[proc] = {
      required: demand[proc]?.[week] ?? 2,
      covered: 0,
      operatorsIn: [],
      operatorsOut: [],
      isHoliday: holidayMap?.[week]?.holidays?.length > 0
    };
  });

  // Filter available bodies
  const eligible = operators.filter(op => {
    if (!op.active) return false;
    if (shiftMode === 'separate' && shiftFilter && op.shift !== shiftFilter) return false;
    if (op.certifications.length === 0) return false;
    return true;
  });

  // Check vacations
  const activeOps = [];
  eligible.forEach(op => {
    const isVacation = vacationBlocks.some(vb => vb.operatorId === op.id && vb.status === 'approved' && week >= vb.startWeek && week <= vb.endWeek);
    if (isVacation) {
      // Mark as out in all their certified processes to show who is missing
      op.certifications.forEach(cert => {
        if (coverageMap[cert]) coverageMap[cert].operatorsOut.push(op);
      });
    } else {
      activeOps.push(op);
    }
  });

  // 1st Pass: Assign operators who only have ONE certification
  const multiCerts = [];
  activeOps.forEach(op => {
    if (op.certifications.length === 1) {
      const proc = op.certifications[0];
      if (coverageMap[proc]) {
        coverageMap[proc].covered++;
        coverageMap[proc].operatorsIn.push(op);
      }
    } else {
      multiCerts.push(op);
    }
  });

  // 2nd Pass: Dynamically assign multi-certified operators to the process that needs them most
  multiCerts.forEach(op => {
    let mostNeededProc = null;
    let lowestRatio = Infinity;

    op.certifications.forEach(proc => {
      const covInfo = coverageMap[proc];
      if (covInfo) {
        // Find fulfillment ratio (e.g., 1/2 = 0.5. The lower, the more needed)
        const ratio = covInfo.required > 0 ? (covInfo.covered / covInfo.required) : Infinity;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          mostNeededProc = proc;
        }
      }
    });

    if (mostNeededProc) {
      coverageMap[mostNeededProc].covered++;
      coverageMap[mostNeededProc].operatorsIn.push(op);
    }
  });

  // Finalize levels
  PROCESSES.forEach(proc => {
    const covInfo = coverageMap[proc];
    if (covInfo.covered >= covInfo.required) covInfo.level = 'green';
    else if (covInfo.covered >= covInfo.required - 1) covInfo.level = 'yellow';
    else covInfo.level = 'red';
  });

  return coverageMap;
}

/**
 * Fallback backward compatibility for individual cell lookups.
 * It's cleaner to precompute globally but this maintains existing API signature.
 */
export function getCoverage(operators, vacationBlocks, demand, process, week, shiftMode, shiftFilter, holidayMap) {
  const globalCoverage = getAllCoverageForWeek(operators, vacationBlocks, demand, week, shiftMode, shiftFilter, holidayMap);
  return globalCoverage[process];
}
