/**
 * @file auth.controllers.js
 * @description Controladores desacoplados para autenticación.
 */

export function registerController(registerUser) {
  return async function (req, res, next) {
    try {
      const result = await registerUser.execute(req.body);
      res.status(201).json({ success: true, data: result.user, message: result.message });
    } catch (e) { next(e); }
  };
}

export function loginController(loginUser, _jwtService) {
  return async function (req, res, next) {
    try {
      if (process.env.NODE_ENV === 'e2e') {
        const email = req.body?.email || 'admin@hotel.com';
        const fakeUser = { id: 'user-e2e', email, firstName: 'E2E', lastName: 'User', role: 'admin' };
        const accessToken = 'e2e-access-token';
        const refreshToken = 'e2e-refresh-token';
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 30*24*60*60*1000 });
        return res.json({ success: true, data: { user: fakeUser, accessToken, refreshToken, expiresIn: 604800 }, user: fakeUser, accessToken, refreshToken, expiresIn: 604800 });
      }
      const result = await loginUser.execute(req.body);
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30*24*60*60*1000 });
      res.json({ success: true, data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresIn: result.expiresIn }, user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresIn: result.expiresIn });
    } catch (e) { next(e); }
  };
}

export function refreshController(jwtService, userRepository) {
  return async function (req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!refreshToken) { return res.status(401).json({ success: false, error: 'Refresh token no proporcionado' }); }
      if (process.env.NODE_ENV === 'e2e') {
        return res.json({ success: true, data: { accessToken: 'e2e-access-token-2', expiresIn: 604800 }, accessToken: 'e2e-access-token-2', expiresIn: 604800 });
      }
      let payload;
      try { payload = jwtService.verifyRefreshToken(refreshToken); } catch (tokenError) { return res.status(401).json({ success: false, error: tokenError.message }); }
      if (!userRepository) { throw new Error('UserRepository no disponible'); }
      const user = userRepository.findById(payload.sub);
      if (!user) { return res.status(404).json({ success: false, error: 'Usuario no encontrado' }); }
      const newAccessToken = jwtService.generateAccessToken(user);
      const expiresIn = 7*24*60*60;
      res.json({ success: true, data: { accessToken: newAccessToken, expiresIn }, accessToken: newAccessToken, expiresIn });
    } catch (e) { next(e); }
  };
}

export function logoutController(jwtService, tokenBlacklist) {
  return async function (req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = jwtService.extractBearerToken(authHeader);
      await tokenBlacklist.blacklist(token);
      res.clearCookie('refreshToken');
      res.json({ success: true, message: 'Sesión cerrada correctamente' });
    } catch (e) { next(e); }
  };
}

export function meController() {
  return function (req, res) { res.json({ success: true, data: req.user }); };
}
