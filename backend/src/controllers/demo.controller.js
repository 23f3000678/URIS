const { processInternCapacity } = require('../services/processInternCapacity');
const { getAssignmentShortlist } = require('../services/assignmentEngine');
const { MOCK_INTERNS } = require('../data/mockInterns');
const logger = require('../utils/logger');

async function runDemo(req, res) {
  try {
    const { busyBlocks, maxFreeBlockHours, weekStatusToggle, task } = req.body;

    const { availability, TLI, capacityScore, capacityLabel } = processInternCapacity({
      busyBlocks,
      maxFreeBlockHours,
      weekStatusToggle,
      tasks: [],
      examFlag: false,
      performanceIndex: 3.5,
      credibilityScore: 75,
    });

    const rankedInterns = getAssignmentShortlist(task, MOCK_INTERNS);

    return res.status(200).json({
      success: true,
      message: 'Demo pipeline executed successfully',
      data: { availability, TLI, capacityScore, capacityLabel, rankedInterns },
    });
  } catch (err) {
    logger.error({ err }, 'runDemo failed');
    return res.status(500).json({ success: false, message: 'Something went wrong while running the demo pipeline', data: null });
  }
}

module.exports = { runDemo };
