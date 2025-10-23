import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

/**
 * OAuth2/OpenID Connect Service
 * 
 * Implements OAuth 2.0 Authorization Code Flow with PKCE
 * and OpenID Connect (OIDC) support for third-party authentication
 */
class OAuth2Service {
  constructor(config = {}) {
    this.config = {
      clientId: config.clientId || process.env.OAUTH_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.OAUTH_CLIENT_SECRET,
      redirectUri: config.redirectUri || process.env.OAUTH_REDIRECT_URI,
      discoveryUrl: config.discoveryUrl || 'https://accounts.google.com/.well-known/openid-configuration',
      scopes: config.scopes || ['openid', 'profile', 'email'],
      responseType: config.responseType || 'code',
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userInfoEndpoint: config.userInfoEndpoint,
      jwksUri: config.jwksUri,
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
      tokenExpiry: config.tokenExpiry || 3600,
      refreshTokenExpiry: config.refreshTokenExpiry || 604800,
      enablePKCE: config.enablePKCE !== false,
      enableNonce: config.enableNonce !== false,
      codeChallengeMethods: config.codeChallengeMethods || ['S256', 'plain'],
      clockTolerance: config.clockTolerance || 60
    };

    this.authorizationCodes = new Map();
    this.refreshTokens = new Map();
    this.idTokens = new Map();
    this.accessTokens = new Map();
    this.pkceStates = new Map();
    this.openidConfig = null;
    this.jwks = null;
    this.metrics = {
      authorizationRequests: 0,
      tokenRequests: 0,
      refreshRequests: 0,
      userInfoRequests: 0,
      validations: 0,
      failures: 0,
      pkceSuccesses: 0,
      pkceFailures: 0
    };
  }

  /**
   * Initialize OAuth2 service with provider configuration
   */
  async initialize() {
    try {
      if (this.config.discoveryUrl) {
        const response = await fetch(this.config.discoveryUrl);
        this.openidConfig = await response.json();

        this.config.authorizationEndpoint = this.openidConfig.authorization_endpoint;
        this.config.tokenEndpoint = this.openidConfig.token_endpoint;
        this.config.userInfoEndpoint = this.openidConfig.userinfo_endpoint;
        this.config.jwksUri = this.openidConfig.jwks_uri;

        if (this.config.jwksUri) {
          await this._fetchJWKS();
        }
      }
      return true;
    } catch (error) {
      console.error('OAuth2 initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Fetch and cache JWKS (JSON Web Key Set)
   */
  async _fetchJWKS() {
    try {
      const response = await fetch(this.config.jwksUri);
      this.jwks = await response.json();
      return true;
    } catch (error) {
      console.error('JWKS fetch failed:', error.message);
      return false;
    }
  }

  /**
   * Generate authorization request URL
   */
  generateAuthorizationUrl(options = {}) {
    this.metrics.authorizationRequests++;

    const state = this._generateSecureString(32);
    let codeChallenge = null;
    let codeChallengeMethod = null;
    let nonce = null;

    const urlParams = {
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: this.config.responseType,
      scope: (options.scopes || this.config.scopes).join(' '),
      state
    };

    // PKCE: Proof Key for Public Clients
    if (this.config.enablePKCE) {
      const codeVerifier = this._generateCodeVerifier();
      codeChallengeMethod = options.codeChallengeMethod || 'S256';

      if (codeChallengeMethod === 'S256') {
        codeChallenge = this._generateCodeChallenge(codeVerifier);
      } else {
        codeChallenge = codeVerifier;
      }

      urlParams.code_challenge = codeChallenge;
      urlParams.code_challenge_method = codeChallengeMethod;

      this.pkceStates.set(state, {
        codeVerifier,
        timestamp: Date.now(),
        used: false
      });
    }

    // OpenID Connect: Nonce for ID Token validation
    if (this.config.enableNonce) {
      nonce = this._generateSecureString(32);
      urlParams.nonce = nonce;
    }

    const authUrl = new URL(this.config.authorizationEndpoint);
    Object.entries(urlParams).forEach(([key, value]) => {
      if (value) authUrl.searchParams.append(key, value);
    });

    return {
      url: authUrl.toString(),
      state,
      nonce,
      codeChallenge,
      codeChallengeMethod
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code, state, options = {}) {
    this.metrics.tokenRequests++;

    try {
      // Validate state
      if (!this._validateState(state)) {
        this.metrics.failures++;
        return { error: 'Invalid state', errorCode: 'INVALID_STATE' };
      }

      // Prepare token request
      const tokenRequest = {
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri
      };

      // Add PKCE verification if applicable
      if (this.config.enablePKCE) {
        const pkceState = this.pkceStates.get(state);
        if (!pkceState || pkceState.used) {
          this.metrics.pkceFailures++;
          return { error: 'PKCE validation failed', errorCode: 'PKCE_VALIDATION_FAILED' };
        }
        tokenRequest.code_verifier = pkceState.codeVerifier;
        pkceState.used = true;
        this.metrics.pkceSuccesses++;
      }

      // Request tokens from provider
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenRequest).toString()
      });

      const tokenResponse = await response.json();

      if (!response.ok) {
        this.metrics.failures++;
        return { error: tokenResponse.error, errorCode: 'TOKEN_REQUEST_FAILED' };
      }

      // Store tokens
      const tokenId = crypto.randomUUID();
      this.accessTokens.set(tokenId, {
        accessToken: tokenResponse.access_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        scope: tokenResponse.scope
      });

      if (tokenResponse.refresh_token) {
        this.refreshTokens.set(tokenId, {
          refreshToken: tokenResponse.refresh_token,
          issuedAt: Date.now()
        });
      }

      if (tokenResponse.id_token && this.config.enableNonce) {
        await this._validateIdToken(tokenResponse.id_token, options.nonce);
        this.idTokens.set(tokenId, {
          idToken: tokenResponse.id_token,
          decodedToken: jwt.decode(tokenResponse.id_token)
        });
      }

      // Cleanup state
      this.pkceStates.delete(state);

      return {
        success: true,
        tokenId,
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type || 'Bearer',
        expiresIn: tokenResponse.expires_in,
        refreshToken: tokenResponse.refresh_token || null,
        idToken: tokenResponse.id_token || null
      };
    } catch (error) {
      this.metrics.failures++;
      console.error('Token exchange failed:', error.message);
      return { error: error.message, errorCode: 'TOKEN_EXCHANGE_FAILED' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(tokenId) {
    this.metrics.refreshRequests++;

    try {
      const refreshTokenData = this.refreshTokens.get(tokenId);
      if (!refreshTokenData) {
        this.metrics.failures++;
        return { error: 'Refresh token not found', errorCode: 'REFRESH_TOKEN_NOT_FOUND' };
      }

      const refreshRequest = {
        grant_type: 'refresh_token',
        refresh_token: refreshTokenData.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      };

      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(refreshRequest).toString()
      });

      const tokenResponse = await response.json();

      if (!response.ok) {
        this.metrics.failures++;
        return { error: tokenResponse.error, errorCode: 'REFRESH_FAILED' };
      }

      // Update access token
      this.accessTokens.set(tokenId, {
        accessToken: tokenResponse.access_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        scope: tokenResponse.scope
      });

      // Update refresh token if new one provided
      if (tokenResponse.refresh_token) {
        this.refreshTokens.set(tokenId, {
          refreshToken: tokenResponse.refresh_token,
          issuedAt: Date.now()
        });
      }

      return {
        success: true,
        accessToken: tokenResponse.access_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: tokenResponse.token_type || 'Bearer'
      };
    } catch (error) {
      this.metrics.failures++;
      console.error('Token refresh failed:', error.message);
      return { error: error.message, errorCode: 'REFRESH_ERROR' };
    }
  }

  /**
   * Get user information from OAuth2 provider
   */
  async getUserInfo(accessToken) {
    this.metrics.userInfoRequests++;

    try {
      const response = await fetch(this.config.userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        this.metrics.failures++;
        return { error: 'User info request failed', errorCode: 'USER_INFO_FAILED' };
      }

      const userInfo = await response.json();
      return { success: true, ...userInfo };
    } catch (error) {
      this.metrics.failures++;
      console.error('User info request failed:', error.message);
      return { error: error.message, errorCode: 'USER_INFO_ERROR' };
    }
  }

  /**
   * Validate ID Token (OpenID Connect)
   */
  async _validateIdToken(idToken, nonce) {
    this.metrics.validations++;

    try {
      const decoded = jwt.decode(idToken, { complete: true });

      if (!decoded) {
        return { valid: false, error: 'Invalid token format' };
      }

      // Verify signature
      const publicKey = this._getPublicKeyForToken(decoded.header.kid);
      jwt.verify(idToken, publicKey);

      // Validate claims
      const now = Math.floor(Date.now() / 1000);
      if (decoded.payload.exp < now - this.config.clockTolerance) {
        return { valid: false, error: 'Token expired' };
      }

      if (decoded.payload.aud !== this.config.clientId) {
        return { valid: false, error: 'Invalid audience' };
      }

      if (decoded.payload.iss !== this.openidConfig.issuer) {
        return { valid: false, error: 'Invalid issuer' };
      }

      if (this.config.enableNonce && decoded.payload.nonce !== nonce) {
        return { valid: false, error: 'Invalid nonce' };
      }

      return { valid: true, decoded: decoded.payload };
    } catch (error) {
      console.error('ID token validation failed:', error.message);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get public key from JWKS for token verification
   */
  _getPublicKeyForToken(kid) {
    if (!this.jwks) return this.config.jwtSecret;

    const key = this.jwks.keys.find(k => k.kid === kid);
    if (!key) return this.config.jwtSecret;

    // This is a simplified version. In production, use jwk-to-pem or similar
    return key;
  }

  /**
   * Create a local session token from OAuth2 identity
   */
  createSessionToken(oauthUser, options = {}) {
    const payload = {
      id: oauthUser.sub || oauthUser.id,
      email: oauthUser.email,
      name: oauthUser.name,
      picture: oauthUser.picture,
      locale: oauthUser.locale,
      provider: options.provider || 'oauth2',
      providerId: oauthUser.sub || oauthUser.id,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.tokenExpiry,
      subject: oauthUser.sub || oauthUser.id,
      issuer: 'oauth2-service'
    });

    return {
      token,
      expiresIn: this.config.tokenExpiry,
      user: payload
    };
  }

  /**
   * Revoke access token
   */
  async revokeAccessToken(tokenId) {
    try {
      const tokenData = this.accessTokens.get(tokenId);
      if (!tokenData) {
        return { error: 'Token not found', errorCode: 'TOKEN_NOT_FOUND' };
      }

      // Optional: Send revocation to provider if they support it
      if (this.config.revocationEndpoint) {
        await fetch(this.config.revocationEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: tokenData.accessToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
          }).toString()
        });
      }

      this.accessTokens.delete(tokenId);
      this.refreshTokens.delete(tokenId);
      this.idTokens.delete(tokenId);

      return { success: true };
    } catch (error) {
      console.error('Token revocation failed:', error.message);
      return { error: error.message, errorCode: 'REVOCATION_FAILED' };
    }
  }

  /**
   * Validate access token
   */
  validateAccessToken(tokenId) {
    const tokenData = this.accessTokens.get(tokenId);
    if (!tokenData) return { valid: false, error: 'Token not found' };

    if (Date.now() > tokenData.expiresAt) {
      this.accessTokens.delete(tokenId);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, token: tokenData };
  }

  /**
   * Check if token needs refresh
   */
  shouldRefreshToken(tokenId, threshold = 300000) {
    const tokenData = this.accessTokens.get(tokenId);
    if (!tokenData) return false;

    const timeUntilExpiry = tokenData.expiresAt - Date.now();
    return timeUntilExpiry < threshold;
  }

  /**
   * Generate authorization code for native apps
   */
  generateAuthorizationCode(userId, scopes = [], expiresIn = 600) {
    const code = this._generateSecureString(48);
    const expiresAt = Date.now() + (expiresIn * 1000);

    this.authorizationCodes.set(code, {
      userId,
      scopes,
      expiresAt,
      exchanged: false
    });

    return { code, expiresIn };
  }

  /**
   * Exchange authorization code for session token
   */
  exchangeAuthorizationCode(code, options = {}) {
    const codeData = this.authorizationCodes.get(code);

    if (!codeData) {
      return { error: 'Code not found', errorCode: 'CODE_NOT_FOUND' };
    }

    if (codeData.expiresAt < Date.now()) {
      this.authorizationCodes.delete(code);
      return { error: 'Code expired', errorCode: 'CODE_EXPIRED' };
    }

    if (codeData.exchanged) {
      return { error: 'Code already used', errorCode: 'CODE_ALREADY_USED' };
    }

    codeData.exchanged = true;

    const sessionToken = this.createSessionToken(
      { sub: codeData.userId },
      { provider: 'local' }
    );

    return { success: true, ...sessionToken };
  }

  /**
   * Cleanup expired tokens and codes
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    // Clean expired authorization codes
    for (const [code, data] of this.authorizationCodes.entries()) {
      if (data.expiresAt < now) {
        this.authorizationCodes.delete(code);
        cleaned++;
      }
    }

    // Clean expired access tokens
    for (const [tokenId, data] of this.accessTokens.entries()) {
      if (data.expiresAt < now) {
        this.accessTokens.delete(tokenId);
        this.refreshTokens.delete(tokenId);
        this.idTokens.delete(tokenId);
        this.pkceStates.delete(tokenId);
        cleaned++;
      }
    }

    // Clean expired PKCE states (should be used quickly)
    for (const [state, data] of this.pkceStates.entries()) {
      if (Date.now() - data.timestamp > 600000) { // 10 min timeout
        this.pkceStates.delete(state);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset service metrics
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
    return true;
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.openidConfig ? 'healthy' : 'initializing',
      initialized: !!this.openidConfig,
      jwksLoaded: !!this.jwks,
      storedTokens: this.accessTokens.size,
      pendingAuthorizations: this.pkceStates.size,
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  _generateSecureString(length) {
    return crypto.randomBytes(length).toString('hex');
  }

  _generateCodeVerifier() {
    const length = Math.floor(Math.random() * 74) + 43;
    return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64url');
  }

  _generateCodeChallenge(codeVerifier) {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  _validateState(state) {
    const pkceState = this.pkceStates.get(state);
    if (!pkceState) return false;
    if (pkceState.used) return false;
    if (Date.now() - pkceState.timestamp > 600000) return false; // 10 min timeout
    return true;
  }

  clear() {
    this.authorizationCodes.clear();
    this.refreshTokens.clear();
    this.idTokens.clear();
    this.accessTokens.clear();
    this.pkceStates.clear();
    return true;
  }
}

export default OAuth2Service;
