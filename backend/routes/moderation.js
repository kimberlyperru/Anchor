const express = require('express');
const router = express.Router();
const { filterText, isExplicit } = require('../utils/moderation');
const Message = require('../models/Message');

// quick filter endpoint for frontend before sending content
router.post('/filter', (req, res) => {
  const { text } = req.body;
  const cleaned = filterText(text);
  const explicit = isExplicit(text);
  res.json({ cleaned, explicit });
});

// report a message
router.post('/report', async (req, res) => {
  const { messageId, reason } = req.body;
  // In prod: store report in DB and notify mods. For demo we just flag the message.
  await Message.findByIdAndUpdate(messageId, { flagged: true });
  res.json({ ok: true });
});

module.exports = router;
