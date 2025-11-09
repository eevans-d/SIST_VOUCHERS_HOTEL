# ISSUE #31: OAuth2/OpenID Connect Service - Documentación Completa

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Conceptos Fundamentales](#conceptos-fundamentales)
3. [Flujos de Autenticación](#flujos-de-autenticación)
4. [OpenID Connect](#openid-connect)
5. [PKCE (Proof Key for Public Clients)](#pkce-proof-key-for-public-clients)
6. [Integración](#integración)
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Resolución de Problemas](#resolución-de-problemas)
9. [Checklist de Validación](#checklist-de-validación)

---

## Descripción General

### ¿Qué es OAuth2/OpenID Connect?

**OAuth2** es un estándar de autorización que permite que los usuarios otorguen acceso a sus recursos en un servidor a aplicaciones terceras sin compartir su contraseña.

**OpenID Connect (OIDC)** es una capa de autenticación construida sobre OAuth2 que añade identificación de usuario y proporciona información de perfil.

```
Sin OAuth2:
┌─────────┐         credenciales         ┌─────────────┐
│ Usuario │ ──────────────────────────→  │ Aplicación  │
└─────────┘                               └─────────────┘
           ← ← ← ← ← ← acceso directo

Con OAuth2:
┌─────────┐                              ┌─────────────┐
│ Usuario │                              │ Aplicación  │
└────┬────┘                              └────┬────────┘
     │                                         │
     │    [1] "Quiero acceder"                 │
     │ ←───────────────────────────────────────┤
     │                                         │
     │                                    ┌─────────────┐
     │    [2] "¿Permites?"                │  Provider   │
     ├───────────────────────────────────→│  (Google,   │
     │                                    │   GitHub)   │
     │    [3] "Sí, autorizo"              └─────────────┘
     │←───────────────────────────────────┤
     │         (código)                    │
     │                                     │
     │    [4] código al provider           │
     │ ←─────────────────────────────────────┤
     │                                     │
     │         [5] acceso token            │
     │ ←─────────────────────────────────────┤
     │                                     │
     │    [6] información de perfil        │
     │ ←─────────────────────────────────────┤
```

### Problemas que Resuelve

- **Seguridad:** No compartir contraseñas con aplicaciones terceras
- **Integración Fácil:** Usar proveedores como Google, GitHub, Microsoft
- **Sesiones Múltiples:** Acceso desde múltiples dispositivos/ubicaciones
- **Revocación:** Revocar acceso sin cambiar contraseña
- **Identificación:** Verificación de identidad del usuario

### Proveedores Soportados

```
✓ Google (OpenID Connect)
✓ GitHub (OAuth2)
✓ Microsoft (OpenID Connect)
✓ Facebook (OAuth2)
✓ LinkedIn (OAuth2)
✓ Cualquier servidor OAuth2/OIDC personalizado
```

---

## Conceptos Fundamentales

### 1. OAuth2 Authorization Code Flow (Flujo Recomendado)

Este es el flujo más seguro para aplicaciones web y móviles:

```
Cliente (SPA)           Auth Server              Resource Server
    │                        │                          │
    │  1. Iniciar login       │                          │
    ├───────────────────────→ │                          │
    │                         │ 2. Mostrar login         │
    │                         │    (usuario/password)    │
    │    3. Generar código    │                          │
    │ ←─────────────────────  │                          │
    │                         │                          │
    │  4. Intercambiar        │                          │
    │     código por token    │                          │
    ├───────────────────────→ │                          │
    │                         │                          │
    │  5. Token (access_token)│                          │
    │ ←─────────────────────  │                          │
    │                         │                          │
    │  6. API con token       │                          │
    ├────────────────────────────────────────────────→   │
    │                                                     │
    │  7. Respuesta                                       │
    │ ←──────────────────────────────────────────────    │
```

**Pasos:**

1. **Redirigir a Proveedor:** Redirigir al usuario a la URL de autorización del proveedor
2. **Usuario Autoriza:** El usuario inicia sesión y autoriza la aplicación
3. **Código de Autorización:** El proveedor redirige al cliente con un código
4. **Intercambiar Código:** El backend intercambia el código por tokens
5. **Access Token:** Se obtiene el token para acceder a recursos
6. **Usar Token:** El cliente usa el token para solicitar recursos

**Ventajas:**

- El token no se expone al navegador del usuario
- Token corta duración para seguridad
- Refresh token para renovación automática
- Soporta revocación de acceso

### 2. Componentes de un Token OAuth2

```
Access Token (Bearer):
    Tipo: JWT (JSON Web Token)
    Duración: 1 hora (típicamente)
    Usado: Para acceder a recursos
    
    {
        "iss": "https://accounts.google.com",
        "sub": "1234567890",
        "aud": "your-client-id",
        "iat": 1516239022,
        "exp": 1516242622
    }

Refresh Token:
    Duración: 7 días - 1 año
    Uso: Renovar access token sin volver a autenticar
    Almacenamiento: Seguro (backend preferiblemente)

ID Token (OpenID Connect):
    Contiene: Información del usuario
    Validación: Verificar firma y claims
    
    {
        "iss": "https://accounts.google.com",
        "aud": "your-client-id",
        "sub": "user-id",
        "email": "user@example.com",
        "email_verified": true,
        "name": "John Doe",
        "picture": "https://...",
        "iat": 1516239022,
        "exp": 1516242622
    }
```

### 3. Scopes de OAuth2

Los scopes definen qué información y recursos puede acceder la aplicación:

```javascript
// Scopes comunes
'openid'              // Identificación (OIDC)
'profile'             // Información básica (nombre, foto)
'email'               // Email del usuario
'address'             // Dirección
'phone'               // Teléfono
'offline_access'      // Refresh token
```

**Ejemplo de solicitud:**

```
GET https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=openid%20profile%20email
  &state=random_state_string
```

### 4. State Parameter (CSRF Protection)

El `state` es un valor opaco generado aleatoriamente para prevenir ataques CSRF:

```javascript
// 1. Generar state
const state = generateRandomString(32);
// state = "a1b2c3d4e5f6..."

// 2. Guardar en sesión
sessionStorage.setState(state);

// 3. Incluir en authorization URL
// https://provider.com/auth?state=a1b2c3d4e5f6...

// 4. Validar en callback
if (receivedState !== storedState) {
  // Ataque CSRF potencial
  throw new Error('State mismatch');
}
```

---

## Flujos de Autenticación

### Flujo 1: Authorization Code Flow (Recomendado)

**Seguridad:** ⭐⭐⭐⭐⭐ Máxima

```javascript
// 1. CLIENTE: Iniciar login
const authUrl = oauth2Service.generateAuthorizationUrl();
// Redirigir a authUrl.url

// 2. USUARIO: Autoriza en el navegador
// El proveedor solicita credenciales y permisos

// 3. PROVEEDOR: Redirige con código
// http://localhost:3000/callback?code=AUTH_CODE&state=STATE

// 4. BACKEND: Intercambiar código por token
const tokenResponse = await oauth2Service.exchangeCodeForToken(
  code,
  state
);
// { accessToken, refreshToken, idToken, tokenId }

// 5. USUARIO: Token almacenado de forma segura
// Usar accessToken para futuras solicitudes
```

**Ventajas:**
- ✅ Más seguro (token no se expone al navegador)
- ✅ Soporta refresh tokens
- ✅ Más adelante es más fácil soportar OAuth2

**Desventajas:**
- ❌ Requiere backend
- ❌ Más pasos

### Flujo 2: Implicit Flow (DEPRECADO - NO USAR)

**Nota:** Este flujo está deprecado en OAuth2 moderno debido a vulnerabilidades de seguridad.

### Flujo 3: Client Credentials Flow

Para aplicaciones servidor-a-servidor sin intervención del usuario:

```javascript
// Solicitar token directamente
const tokenResponse = await fetch('https://provider.com/token', {
  method: 'POST',
  body: {
    grant_type: 'client_credentials',
    client_id: 'app-id',
    client_secret: 'app-secret'
  }
});
```

---

## OpenID Connect

### ¿Qué Añade OIDC a OAuth2?

OAuth2 es para **autorización** (qué puedes hacer), OIDC es para **autenticación** (quién eres):

```
OAuth2 → "¿Tengo permiso para acceder a tus fotos?"
OIDC    → "¿Eres realmente John Doe?"

OIDC = OAuth2 + ID Token + UserInfo Endpoint
```

### ID Token vs Access Token

```javascript
// ID Token (OIDC)
{
  "iss": "https://accounts.google.com",
  "aud": "your-client-id",
  "sub": "user-123",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://example.com/photo.jpg",
  "locale": "es-ES",
  "iat": 1516239022,
  "exp": 1516242622
}

// Access Token (OAuth2)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWI...
(Opaco para el cliente, usado para llamadas a API)
```

### Validación de ID Token

```javascript
// 1. Verificar firma
const publicKey = getPublicKeyFromJWKS(token.header.kid);
jwt.verify(idToken, publicKey);

// 2. Verificar claims
if (token.payload.aud !== clientId) {
  throw new Error('Invalid audience');
}
if (token.payload.iss !== expectedIssuer) {
  throw new Error('Invalid issuer');
}
if (token.payload.exp < currentTime) {
  throw new Error('Token expired');
}

// 3. Validar nonce (si se usó)
if (token.payload.nonce !== sessionNonce) {
  throw new Error('Nonce mismatch - CSRF attack?');
}
```

### OpenID Connect Discovery

Los proveedores OIDC publican su configuración en:

```
GET https://provider.com/.well-known/openid-configuration

Respuesta:
{
  "authorization_endpoint": "https://...",
  "token_endpoint": "https://...",
  "userinfo_endpoint": "https://...",
  "jwks_uri": "https://...",
  "issuer": "https://...",
  "scopes_supported": ["openid", "profile", "email", ...],
  "subject_types_supported": ["public", "pairwise"],
  "id_token_signing_alg_values_supported": ["RS256"],
  ...
}
```

---

## PKCE (Proof Key for Public Clients)

### ¿Qué Problema Resuelve PKCE?

En aplicaciones móviles y SPAs, el `client_secret` no se puede mantener seguro. PKCE añade una capa de seguridad:

```
SIN PKCE (Vulnerable):
Atacante intercepta código → Puede canjear sin secret

CON PKCE (Seguro):
Atacante intercepta código → No puede canjear sin code_verifier
```

### Flujo PKCE (RFC 7636)

```
1. GENERAR
   code_verifier = random string (43-128 caracteres)
   code_challenge = SHA256(code_verifier)
   code_challenge_method = "S256"

2. ENVIAR A AUTH
   GET /auth?
     client_id=...
     code_challenge=...
     code_challenge_method=S256
     ...

3. AUTORIZAR
   Usuario autoriza

4. RECIBIR CÓDIGO
   GET /callback?code=AUTH_CODE

5. CANJEAR CON VERIFIER
   POST /token
     grant_type=authorization_code
     code=AUTH_CODE
     client_id=...
     code_verifier=original_random_string
     
   Servidor calcula:
   SHA256(code_verifier) === code_challenge enviado?
   
   Si no coincide → Rechazar → Atacante no puede canjear
```

### Implementación en OAuth2Service

```javascript
// Generar
const authUrl = oauth2Service.generateAuthorizationUrl();
// Genera automáticamente:
//   - code_verifier (aleatorio)
//   - code_challenge (SHA256 del verifier)
//   - code_challenge_method ("S256")

// Intercambiar
const result = await oauth2Service.exchangeCodeForToken(code, state);
// Valida automáticamente:
//   - Verifica code_verifier contra code_challenge
//   - Solo permite si coinciden
//   - Previene reutilización
```

---

## Integración

### Configuración Inicial

```javascript
import OAuth2Service from './services/oauth2Service.js';

// 1. Crear servicio
const oauth2 = new OAuth2Service({
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/callback',
  discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
  scopes: ['openid', 'profile', 'email'],
  tokenExpiry: 3600,
  refreshTokenExpiry: 604800,
  enablePKCE: true,
  enableNonce: true
});

// 2. Inicializar (descarga config del proveedor)
await oauth2.initialize();
```

### Flujo de Login Completo

#### Frontend (SPA)

```javascript
// 1. Usuario hace clic en "Login with Google"
function handleLoginClick() {
  // Obtener URL de autorización del backend
  const response = await fetch('/auth/oauth2/authorize');
  const { authUrl } = await response.json();
  
  // Redirigir a proveedor
  window.location.href = authUrl;
}

// 2. Callback (después que usuario autoriza)
// URL: /callback?code=AUTH_CODE&state=STATE
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  
  // Enviar código al backend
  const response = await fetch('/auth/oauth2/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state })
  });
  
  const { sessionToken } = await response.json();
  
  // Guardar token localmente
  localStorage.setItem('sessionToken', sessionToken);
  
  // Redirigir a inicio
  window.location.href = '/';
}
```

#### Backend (Express)

```javascript
// 1. Iniciar autorización
app.get('/auth/oauth2/authorize', (req, res) => {
  const authUrl = oauth2.generateAuthorizationUrl();
  
  // Guardar en sesión para validación posterior
  req.session.oauthState = authUrl.state;
  req.session.oauthNonce = authUrl.nonce;
  
  res.json({ authUrl: authUrl.url });
});

// 2. Callback
app.post('/auth/oauth2/callback', async (req, res) => {
  const { code, state } = req.body;
  
  // Intercambiar código por token
  const tokenResult = await oauth2.exchangeCodeForToken(
    code,
    state
  );
  
  if (!tokenResult.success) {
    return res.status(400).json({ error: tokenResult.error });
  }
  
  // Obtener información del usuario
  const userInfo = await oauth2.getUserInfo(tokenResult.accessToken);
  
  // Crear usuario en BD si no existe
  let user = await User.findByOAuthId(userInfo.sub);
  if (!user) {
    user = await User.create({
      oauthProvider: 'google',
      oauthId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    });
  }
  
  // Crear sesión local
  const sessionToken = oauth2.createSessionToken(
    { sub: user.id, email: user.email, name: user.name },
    { provider: 'local' }
  );
  
  res.json({ sessionToken: sessionToken.token });
});
```

### Renovación de Token

```javascript
// Middleware para renovar token automáticamente
app.use((req, res, next) => {
  const tokenId = req.session.oauth2TokenId;
  
  if (tokenId && oauth2.shouldRefreshToken(tokenId, 300000)) {
    // Token expira en menos de 5 minutos
    oauth2.refreshAccessToken(tokenId).then(result => {
      if (result.success) {
        req.session.oauth2AccessToken = result.accessToken;
      }
    });
  }
  
  next();
});
```

---

## Ejemplos de Uso

### Ejemplo 1: Login Social Simple

```javascript
const oauth2 = new OAuth2Service({
  clientId: 'google-client-id',
  clientSecret: 'google-client-secret',
  redirectUri: 'https://example.com/auth/callback',
  discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration'
});

await oauth2.initialize();

// Usuario hace clic en "Login with Google"
const { url, state, nonce } = oauth2.generateAuthorizationUrl({
  scopes: ['openid', 'profile', 'email']
});

// Guardar state y nonce en sesión
req.session.state = state;
req.session.nonce = nonce;

// Redirigir
res.redirect(url);

// En callback
const { code, state: returnedState } = req.query;

const tokenResult = await oauth2.exchangeCodeForToken(code, returnedState);
const userInfo = await oauth2.getUserInfo(tokenResult.accessToken);

// Crear usuario local
const user = await createOrUpdateUser(userInfo);
req.session.user = user;
```

### Ejemplo 2: Múltiples Proveedores

```javascript
const oauth2Google = new OAuth2Service({
  clientId: process.env.GOOGLE_CLIENT_ID,
  discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration'
});

const oauth2GitHub = new OAuth2Service({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user'
});

app.get('/auth/google', (req, res) => {
  const { url } = oauth2Google.generateAuthorizationUrl();
  res.redirect(url);
});

app.get('/auth/github', (req, res) => {
  const { url } = oauth2GitHub.generateAuthorizationUrl();
  res.redirect(url);
});

app.post('/auth/callback', async (req, res) => {
  const { provider, code, state } = req.body;
  
  const oauth2 = provider === 'google' ? oauth2Google : oauth2GitHub;
  const tokens = await oauth2.exchangeCodeForToken(code, state);
  const user = await oauth2.getUserInfo(tokens.accessToken);
  
  // Crear usuario con identificador de proveedor
  const localUser = await User.findOrCreate({
    provider,
    providerId: user.sub || user.id,
    email: user.email,
    name: user.name
  });
  
  req.session.user = localUser;
  res.json({ success: true });
});
```

### Ejemplo 3: Manejo de Errores

```javascript
async function safeOAuth2Callback(req, res) {
  try {
    const { code, state } = req.body;
    
    // Validar entrada
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    
    // Intercambiar código
    const tokens = await oauth2.exchangeCodeForToken(code, state);
    
    if (!tokens.success) {
      if (tokens.errorCode === 'INVALID_STATE') {
        return res.status(403).json({ error: 'CSRF detection' });
      }
      if (tokens.errorCode === 'PKCE_VALIDATION_FAILED') {
        return res.status(403).json({ error: 'Security validation failed' });
      }
      return res.status(400).json({ error: tokens.error });
    }
    
    // Obtener usuario
    const userInfo = await oauth2.getUserInfo(tokens.accessToken);
    
    if (!userInfo.success) {
      return res.status(500).json({ error: 'Failed to get user info' });
    }
    
    // Crear usuario
    const user = await User.findOrCreate({
      email: userInfo.email,
      oauthId: userInfo.sub,
      name: userInfo.name
    });
    
    res.json({ 
      sessionToken: oauth2.createSessionToken(user).token 
    });
    
  } catch (error) {
    console.error('OAuth2 callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Resolución de Problemas

### Problema 1: "Invalid State" Error

**Síntoma:** Error "INVALID_STATE" en callback

**Causas:**

1. **Session expirada:** La sesión se perdió entre autorización y callback
2. **State manipulado:** El parámetro state fue alterado
3. **Ataque CSRF:** Intento malicioso de cambiar el state
4. **Múltiples pestañas:** El mismo state se está usando en dos navegadores

**Solución:**

```javascript
// Almacenar state en localStorage también (más seguro)
const { url, state } = oauth2.generateAuthorizationUrl();
localStorage.setItem('oauth2_state', state);
sessionStorage.setItem('oauth2_state', state);

// En callback, validar ambos
const storedState = localStorage.getItem('oauth2_state') || 
                    sessionStorage.getItem('oauth2_state');
if (returnedState !== storedState) {
  throw new Error('State mismatch - CSRF detected');
}
```

### Problema 2: "Code Already Used"

**Síntoma:** Error "CODE_ALREADY_USED" en segundo intento

**Causas:**

1. **Código reutilizado:** Intentar usar el mismo código dos veces
2. **Reintentos automáticos:** El navegador reintentó la solicitud
3. **Bug en cliente:** El callback se ejecutó dos veces

**Solución:**

```javascript
// En callback, marcar que se procesó
if (!sessionStorage.getItem('oauth2_processed')) {
  sessionStorage.setItem('oauth2_processed', 'true');
  
  // Procesar código
  const result = await oauth2.exchangeCodeForToken(code, state);
  
  if (result.success) {
    sessionStorage.removeItem('oauth2_processed');
  }
} else {
  console.log('Callback ya fue procesado');
}
```

### Problema 3: Tokens No Se Renuevan

**Síntoma:** "Token expired" después de 1 hora

**Causas:**

1. **Refresh token no guardado:** No se guardó el refresh token
2. **Renovación no automática:** Falta lógica de renovación
3. **Sesión expirada:** La sesión fue limpiada

**Solución:**

```javascript
// Guardar refresh token de forma segura
const tokens = await oauth2.exchangeCodeForToken(code, state);
req.session.oauth2TokenId = tokens.tokenId;
req.session.oauth2RefreshToken = tokens.refreshToken; // Seguro en backend

// Middleware de renovación
app.use(async (req, res, next) => {
  if (req.session.oauth2TokenId && 
      oauth2.shouldRefreshToken(req.session.oauth2TokenId)) {
    
    const newTokens = await oauth2.refreshAccessToken(
      req.session.oauth2TokenId
    );
    
    if (newTokens.success) {
      // Token renovado exitosamente
    }
  }
  next();
});
```

### Problema 4: PKCE Falla en Producción

**Síntoma:** "PKCE validation failed" solo en producción

**Causas:**

1. **code_verifier no persiste:** Se genera en un dominio, se verifica en otro
2. **Storage diferente:** Cada servidor tiene su propio storage en memoria
3. **Load balancing:** Diferentes servidores en different llamadas

**Solución:**

```javascript
// Guardar PKCE state en BD en lugar de en memoria
async function storeAndRetrievePKCE(state, codeVerifier) {
  if (codeVerifier) {
    // Guardar
    await PKCEState.create({ state, codeVerifier });
  } else {
    // Recuperar
    const stored = await PKCEState.findByState(state);
    return stored?.codeVerifier;
  }
}

// En generateAuthorizationUrl
const { codeVerifier, state } = ...;
await storeAndRetrievePKCE(state, codeVerifier);

// En exchangeCodeForToken
const codeVerifier = await storeAndRetrievePKCE(state);
if (!codeVerifier) throw new Error('PKCE validation failed');
```

---

## Checklist de Validación

### Antes de Producción

- [ ] OpenID Configuration Discovery funciona
- [ ] PKCE habilitado para SPAs y mobile
- [ ] Nonce habilitado y validado
- [ ] State protection implementado
- [ ] HTTPS obligatorio (no HTTP)
- [ ] Client ID y Secret seguros en env vars
- [ ] Redirect URI whitelist validado
- [ ] JWT signature verification implementado
- [ ] Token expiry validado
- [ ] Refresh token almacenado de forma segura
- [ ] CSRF protection en callback
- [ ] Cleanup de tokens/codes expirados
- [ ] Logs de autenticación
- [ ] Manejo de errores de proveedor
- [ ] Multiple proveedores soportados
- [ ] Rate limiting en endpoints de auth
- [ ] Tests de flujo completo
- [ ] Documentación de endpoints

### Operaciones

- [ ] Monitorear fallos de autenticación
- [ ] Revisar logs de tokens inválidos
- [ ] Limpiar tokens expirados
- [ ] Validar que JWKS se actualiza
- [ ] Probar revocación de tokens
- [ ] Auditar accesos de usuarios nuevos

---

## Resumen

OAuth2/OpenID Connect proporciona autenticación segura y escalable mediante proveedores de terceros. OAuth2Service simplifica la integración con:

- ✅ Soporte para Authorization Code Flow
- ✅ PKCE para protección de clientes públicos
- ✅ OpenID Connect para autenticación
- ✅ Validación de ID Token
- ✅ Refresh token automático
- ✅ Multi-proveedor ready
- ✅ Limpieza automática de tokens

**Próximos Pasos:**

1. Registrar aplicación en proveedor (Google, GitHub, etc.)
2. Configurar OAuth2Service con credentials
3. Implementar endpoints de login/callback
4. Probar flujo completo
5. Configurar múltiples proveedores

---

**Versión:** 1.0.0  
**Última Actualización:** Sprint 5, Octubre 2025  
**Autor:** Sistema de Seguridad Avanzada  
**Estado:** Producción
