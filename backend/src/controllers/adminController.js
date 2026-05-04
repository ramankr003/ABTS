const User = require('../models/User');
const Ambulance = require('../models/Ambulance');
const Booking = require('../models/Booking');

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalDrivers = await User.countDocuments({ role: 'driver' });
    const totalAmbulances = await Ambulance.countDocuments();
    const availableAmbulances = await Ambulance.countDocuments({ isAvailable: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: today } });
    const totalBookings = await Booking.countDocuments();

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalDrivers,
        totalAmbulances,
        availableAmbulances,
        bookingsToday,
        totalBookings
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/bookings
exports.getAllBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name phone email')
      .populate('ambulance', 'vehicleNumber driverName')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id/ban
exports.toggleBanUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.isVerified = !user.isVerified; // Using isVerified as an active/ban flag for now
    await user.save();
    
    res.json({ success: true, message: `User ${user.isVerified ? 'activated' : 'banned'}` });
  } catch (error) {
    next(error);
  }
};
