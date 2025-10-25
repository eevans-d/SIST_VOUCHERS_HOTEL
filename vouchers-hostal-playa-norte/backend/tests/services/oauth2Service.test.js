import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import OAuth2Service from '../services/oauth2Service.js';

describe('OAuth2Service', () => {
  let oauth2Service;
  let mockFetch;

  beforeEach(() => {
    oauth2Service = new OAuth2Service({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      jwtSecret: 'test-jwt-secret',
      discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration'
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const svc = new OAuth2Service();
      expect(svc.config.enablePKCE).toBe(true);
      expect(svc.config.enableNonce).toBe(true);
    });

    it('should initialize with custom config', () => {
      const svc = new OAuth2Service({
        clientId: 'custom-id',
        tokenExpiry: 7200
      });
      expect(svc.config.clientId).toBe('custom-id');
      expect(svc.config.tokenExpiry).toBe(7200);
    });

    it('should disable PKCE if configured', () => {
      const svc = new OAuth2Service({ enablePKCE: false });
      expect(svc.config.enablePKCE).toBe(false);
    });

    it('should disable nonce if configured', () => {
      const svc = new OAuth2Service({ enableNonce: false });
      expect(svc.config.enableNonce).toBe(false);
    });
  });

  // ===== DISCOVERY AND INITIALIZATION TESTS =====

  describe('OpenID Configuration Discovery', () => {
    it('should fetch OpenID configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          token_endpoint: 'https://oauth2.googleapis.com/token',
          userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
          jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
          issuer: 'https://accounts.google.com'
        })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: []
        })
      });

      const result = await oauth2Service.initialize();

      expect(result).toBe(true);
      expect(oauth2Service.openidConfig).toBeDefined();
      expect(oauth2Service.openidConfig.authorization_endpoint).toBeDefined();
    });

    it('should handle discovery failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await oauth2Service.initialize();

      expect(result).toBe(false);
      expect(oauth2Service.openidConfig).toBeNull();
    });
  });

  // ===== AUTHORIZATION URL GENERATION TESTS =====

  describe('Authorization URL Generation', () => {
    it('should generate authorization URL', () => {
      const result = oauth2Service.generateAuthorizationUrl();

      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('scope=');
    });

    it('should include PKCE parameters', () => {
      const result = oauth2Service.generateAuthorizationUrl();

      expect(result.codeChallenge).toBeDefined();
      expect(result.codeChallengeMethod).toBeDefined();
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('code_challenge_method=');
    });

    it('should include nonce parameter', () => {
      const result = oauth2Service.generateAuthorizationUrl();

      expect(result.nonce).toBeDefined();
      expect(result.url).toContain('nonce=');
    });

    it('should allow custom scopes', () => {
      const result = oauth2Service.generateAuthorizationUrl({
        scopes: ['openid', 'profile', 'email', 'custom']
      });

      expect(result.url).toContain('openid');
      expect(result.url).toContain('custom');
    });

    it('should store PKCE state', () => {
      oauth2Service.generateAuthorizationUrl();

      expect(oauth2Service.pkceStates.size).toBe(1);
    });

    it('should increment authorization request metrics', () => {
      oauth2Service.generateAuthorizationUrl();

      expect(oauth2Service.metrics.authorizationRequests).toBe(1);
    });

    it('should use S256 code challenge method by default', () => {
      const result = oauth2Service.generateAuthorizationUrl();

      expect(result.codeChallengeMethod).toBe('S256');
    });

    it('should allow plain code challenge method', () => {
      const result = oauth2Service.generateAuthorizationUrl({
        codeChallengeMethod: 'plain'
      });

      expect(result.codeChallengeMethod).toBe('plain');
      expect(result.codeChallenge).toBe(result.codeChallenge);
    });
  });

  // ===== TOKEN EXCHANGE TESTS =====

  describe('Token Exchange', () => {
    it('should exchange code for token', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'test-refresh-token'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken(
        'test-code',
        authUrl.state
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.tokenId).toBeDefined();
    });

    it('should reject invalid state', async () => {
      const result = await oauth2Service.exchangeCodeForToken(
        'test-code',
        'invalid-state'
      );

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('INVALID_STATE');
    });

    it('should validate PKCE', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      // Use the state but get the PKCE data
      const pkceData = oauth2Service.pkceStates.get(authUrl.state);
      expect(pkceData.codeVerifier).toBeDefined();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      });

      const result = await oauth2Service.exchangeCodeForToken(
        'test-code',
        authUrl.state
      );

      expect(result.success).toBe(true);
      expect(oauth2Service.metrics.pkceSuccesses).toBe(1);
    });

    it('should reject PKCE if already used', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600
        })
      });

      // First exchange
      await oauth2Service.exchangeCodeForToken('code1', authUrl.state);

      // Try to reuse
      const result = await oauth2Service.exchangeCodeForToken('code2', authUrl.state);

      expect(result.errorCode).toBe('PKCE_VALIDATION_FAILED');
      expect(oauth2Service.metrics.pkceFailures).toBe(1);
    });

    it('should handle token endpoint error', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_code'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken(
        'invalid-code',
        authUrl.state
      );

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('TOKEN_REQUEST_FAILED');
    });

    it('should increment token request metrics', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600
        })
      });

      await oauth2Service.exchangeCodeForToken('code', authUrl.state);

      expect(oauth2Service.metrics.tokenRequests).toBe(1);
    });

    it('should store tokens', async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          refresh_token: 'test-refresh'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken('code', authUrl.state);

      expect(oauth2Service.accessTokens.get(result.tokenId)).toBeDefined();
      expect(oauth2Service.refreshTokens.get(result.tokenId)).toBeDefined();
    });
  });

  // ===== REFRESH TOKEN TESTS =====

  describe('Token Refresh', () => {
    beforeEach(async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'initial-token',
          expires_in: 3600,
          refresh_token: 'test-refresh-token'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken('code', authUrl.state);
      this.tokenId = result.tokenId;
    });

    it('should refresh access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600
        })
      });

      const result = await oauth2Service.refreshAccessToken(this.tokenId);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should update token expiry on refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 7200
        })
      });

      await oauth2Service.refreshAccessToken(this.tokenId);

      const tokenData = oauth2Service.accessTokens.get(this.tokenId);
      expect(tokenData.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should reject if refresh token not found', async () => {
      const result = await oauth2Service.refreshAccessToken('invalid-token-id');

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('REFRESH_TOKEN_NOT_FOUND');
    });

    it('should increment refresh metrics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600
        })
      });

      await oauth2Service.refreshAccessToken(this.tokenId);

      expect(oauth2Service.metrics.refreshRequests).toBe(1);
    });
  });

  // ===== USER INFO TESTS =====

  describe('User Info Endpoint', () => {
    it('should fetch user info', async () => {
      oauth2Service.config.userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: '123456',
          email: 'user@example.com',
          name: 'John Doe',
          picture: 'https://example.com/pic.jpg'
        })
      });

      const result = await oauth2Service.getUserInfo('test-access-token');

      expect(result.success).toBe(true);
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('John Doe');
    });

    it('should include Authorization header', async () => {
      oauth2Service.config.userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await oauth2Service.getUserInfo('test-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openidconnect.googleapis.com/v1/userinfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should handle user info failure', async () => {
      oauth2Service.config.userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';

      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await oauth2Service.getUserInfo('invalid-token');

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('USER_INFO_FAILED');
    });

    it('should increment user info metrics', async () => {
      oauth2Service.config.userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await oauth2Service.getUserInfo('token');

      expect(oauth2Service.metrics.userInfoRequests).toBe(1);
    });
  });

  // ===== SESSION TOKEN TESTS =====

  describe('Session Token Creation', () => {
    it('should create session token from OAuth user', () => {
      const oauthUser = {
        sub: 'google-123',
        email: 'user@example.com',
        name: 'John Doe',
        picture: 'https://example.com/pic.jpg'
      };

      const result = oauth2Service.createSessionToken(oauthUser);

      expect(result.token).toBeDefined();
      expect(result.expiresIn).toBe(oauth2Service.config.tokenExpiry);
      expect(result.user.email).toBe('user@example.com');
    });

    it('should include provider in token', () => {
      const oauthUser = { sub: '123', email: 'test@example.com' };

      const result = oauth2Service.createSessionToken(oauthUser, { provider: 'google' });

      expect(result.user.provider).toBe('google');
    });
  });

  // ===== TOKEN VALIDATION TESTS =====

  describe('Token Validation', () => {
    beforeEach(async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          refresh_token: 'test-refresh'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken('code', authUrl.state);
      this.tokenId = result.tokenId;
    });

    it('should validate active token', () => {
      const result = oauth2Service.validateAccessToken(this.tokenId);

      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should reject expired token', () => {
      const tokenData = oauth2Service.accessTokens.get(this.tokenId);
      tokenData.expiresAt = Date.now() - 1000;

      const result = oauth2Service.validateAccessToken(this.tokenId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject non-existent token', () => {
      const result = oauth2Service.validateAccessToken('invalid-id');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ===== REFRESH THRESHOLD TESTS =====

  describe('Refresh Threshold Checks', () => {
    beforeEach(async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          refresh_token: 'test-refresh'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken('code', authUrl.state);
      this.tokenId = result.tokenId;
    });

    it('should indicate refresh needed when expiring soon', () => {
      const tokenData = oauth2Service.accessTokens.get(this.tokenId);
      tokenData.expiresAt = Date.now() + 100000; // 100 seconds

      const result = oauth2Service.shouldRefreshToken(this.tokenId, 300000); // 5 min threshold

      expect(result).toBe(true);
    });

    it('should not indicate refresh if sufficient time', () => {
      const tokenData = oauth2Service.accessTokens.get(this.tokenId);
      tokenData.expiresAt = Date.now() + 3600000; // 1 hour

      const result = oauth2Service.shouldRefreshToken(this.tokenId, 300000);

      expect(result).toBe(false);
    });
  });

  // ===== AUTHORIZATION CODE TESTS =====

  describe('Authorization Code (Native Apps)', () => {
    it('should generate authorization code', () => {
      const result = oauth2Service.generateAuthorizationCode('user-123');

      expect(result.code).toBeDefined();
      expect(result.expiresIn).toBe(600);
    });

    it('should store authorization code with expiry', () => {
      const result = oauth2Service.generateAuthorizationCode('user-123', [], 300);

      const stored = oauth2Service.authorizationCodes.get(result.code);
      expect(stored.userId).toBe('user-123');
      expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 300000);
    });

    it('should exchange authorization code for session token', () => {
      const codeResult = oauth2Service.generateAuthorizationCode('user-123');
      const result = oauth2Service.exchangeAuthorizationCode(codeResult.code);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user.id).toBe('user-123');
    });

    it('should reject expired authorization code', () => {
      const codeResult = oauth2Service.generateAuthorizationCode('user-123', [], 1);
      const code = codeResult.code;

      const codeData = oauth2Service.authorizationCodes.get(code);
      codeData.expiresAt = Date.now() - 1000;

      const result = oauth2Service.exchangeAuthorizationCode(code);

      expect(result.errorCode).toBe('CODE_EXPIRED');
    });

    it('should reject already-used authorization code', () => {
      const codeResult = oauth2Service.generateAuthorizationCode('user-123');

      oauth2Service.exchangeAuthorizationCode(codeResult.code);
      const result = oauth2Service.exchangeAuthorizationCode(codeResult.code);

      expect(result.errorCode).toBe('CODE_ALREADY_USED');
    });

    it('should reject non-existent code', () => {
      const result = oauth2Service.exchangeAuthorizationCode('invalid-code');

      expect(result.errorCode).toBe('CODE_NOT_FOUND');
    });
  });

  // ===== TOKEN REVOCATION TESTS =====

  describe('Token Revocation', () => {
    beforeEach(async () => {
      const authUrl = oauth2Service.generateAuthorizationUrl();
      oauth2Service.config.tokenEndpoint = 'https://oauth2.googleapis.com/token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          refresh_token: 'test-refresh'
        })
      });

      const result = await oauth2Service.exchangeCodeForToken('code', authUrl.state);
      this.tokenId = result.tokenId;
    });

    it('should revoke access token', async () => {
      const result = await oauth2Service.revokeAccessToken(this.tokenId);

      expect(result.success).toBe(true);
      expect(oauth2Service.accessTokens.has(this.tokenId)).toBe(false);
    });

    it('should reject revocation of non-existent token', async () => {
      const result = await oauth2Service.revokeAccessToken('invalid-id');

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('TOKEN_NOT_FOUND');
    });

    it('should remove refresh token on revocation', async () => {
      expect(oauth2Service.refreshTokens.has(this.tokenId)).toBe(true);

      await oauth2Service.revokeAccessToken(this.tokenId);

      expect(oauth2Service.refreshTokens.has(this.tokenId)).toBe(false);
    });

    it('should remove ID token on revocation', async () => {
      await oauth2Service.revokeAccessToken(this.tokenId);

      expect(oauth2Service.idTokens.has(this.tokenId)).toBe(false);
    });
  });

  // ===== CLEANUP TESTS =====

  describe('Cleanup Operations', () => {
    it('should cleanup expired authorization codes', () => {
      oauth2Service.generateAuthorizationCode('user-1');
      oauth2Service.generateAuthorizationCode('user-2', [], 1);

      const codeEntries = Array.from(oauth2Service.authorizationCodes.values());
      codeEntries[1].expiresAt = Date.now() - 1000;

      const cleaned = oauth2Service.cleanup();

      expect(oauth2Service.authorizationCodes.size).toBe(1);
      expect(cleaned).toBeGreaterThan(0);
    });

    it('should cleanup expired PKCE states', async () => {
      oauth2Service.generateAuthorizationUrl();

      const states = Array.from(oauth2Service.pkceStates.values());
      states[0].timestamp = Date.now() - 700000; // 11+ minutes

      const cleaned = oauth2Service.cleanup();

      expect(oauth2Service.pkceStates.size).toBe(0);
      expect(cleaned).toBeGreaterThan(0);
    });
  });

  // ===== METRICS TESTS =====

  describe('Metrics', () => {
    it('should return service metrics', () => {
      oauth2Service.generateAuthorizationUrl();

      const metrics = oauth2Service.getMetrics();

      expect(metrics.authorizationRequests).toBe(1);
      expect(metrics.tokenRequests).toBe(0);
    });

    it('should reset metrics', () => {
      oauth2Service.metrics.authorizationRequests = 10;

      oauth2Service.resetMetrics();

      expect(oauth2Service.metrics.authorizationRequests).toBe(0);
      expect(oauth2Service.metrics.tokenRequests).toBe(0);
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Checks', () => {
    it('should report initializing status before discovery', () => {
      const health = oauth2Service.getHealth();

      expect(health.status).toBe('initializing');
      expect(health.initialized).toBe(false);
    });

    it('should include token counts in health', () => {
      oauth2Service.generateAuthorizationCode('user-1');

      const health = oauth2Service.getHealth();

      expect(health.storedTokens).toBe(0);
      expect(health.pendingAuthorizations).toBe(1);
    });

    it('should include timestamp in health', () => {
      const health = oauth2Service.getHealth();

      expect(health.timestamp).toBeDefined();
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle multiple concurrent authorization requests', () => {
      const urls = [
        oauth2Service.generateAuthorizationUrl(),
        oauth2Service.generateAuthorizationUrl(),
        oauth2Service.generateAuthorizationUrl()
      ];

      expect(oauth2Service.pkceStates.size).toBe(3);
      expect(urls[0].state).not.toBe(urls[1].state);
    });

    it('should handle cleanup with no expired data', () => {
      oauth2Service.generateAuthorizationCode('user-1');

      const cleaned = oauth2Service.cleanup();

      expect(oauth2Service.authorizationCodes.size).toBe(1);
      expect(cleaned).toBe(0);
    });

    it('should handle clear operation', () => {
      oauth2Service.generateAuthorizationUrl();
      oauth2Service.generateAuthorizationCode('user-1');

      oauth2Service.clear();

      expect(oauth2Service.authorizationCodes.size).toBe(0);
      expect(oauth2Service.pkceStates.size).toBe(0);
      expect(oauth2Service.accessTokens.size).toBe(0);
    });
  });
});
