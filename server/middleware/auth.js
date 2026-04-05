const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

export function createSession(res, user) {
  const payload = JSON.stringify({
    id: user.id,
    role: user.role,
    schoolId: user.school_id,
  });
  res.cookie('session', payload, {
    httpOnly: true,
    signed: true,
    maxAge: user.role === 'student' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });
}

export function requireAuth(req, res, next) {
  const session = req.signedCookies?.session;
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = JSON.parse(session);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
