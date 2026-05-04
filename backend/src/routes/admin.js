const express = require('express');
const router = express.Router();
const { getStats, getAllUsers, getAllBookings, toggleBanUser } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes must be protected and restricted to 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.get('/bookings', getAllBookings);
router.put('/users/:id/ban', toggleBanUser);

module.exports = router;
