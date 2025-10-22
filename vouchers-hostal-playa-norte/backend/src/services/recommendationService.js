/**
 * Recommendation Engine Service
 * Provides content-based and collaborative filtering recommendations
 * for hotel rooms and packages
 */

class RecommendationService {
  constructor() {
    this.roomProfiles = new Map(); // Características de habitaciones
    this.userPreferences = new Map(); // Preferencias de usuarios
    this.interactionHistory = new Map(); // Historial view/book/rate
    this.recommendations = new Map(); // Cache de recomendaciones
    this.collaborativeMatrix = new Map(); // Matriz de similaridad usuario-usuario
    this.contentMatrix = new Map(); // Matriz de similaridad item-item
  }

  /**
   * Registrar perfil de habitación
   * @param {string} roomId - ID de la habitación
   * @param {object} features - Características (type, price, amenities, etc)
   */
  setRoomProfile(roomId, features) {
    const profile = {
      roomId,
      type: features.type || 'standard',
      price: features.price || 100,
      amenities: features.amenities || [],
      capacity: features.capacity || 2,
      rating: features.rating || 4.0,
      views: features.views || 'city',
      size: features.size || 30, // m²
      features: features.features || [],
      floor: features.floor || 1,
      lastUpdated: Date.now()
    };

    this.roomProfiles.set(roomId, profile);
    
    // Actualizar matriz de contenido
    this._updateContentSimilarities();

    return profile;
  }

  /**
   * Obtener perfil de habitación
   * @param {string} roomId - ID de la habitación
   * @returns {object} Perfil de la habitación
   */
  getRoomProfile(roomId) {
    return this.roomProfiles.get(roomId) || null;
  }

  /**
   * Registrar interacción de usuario
   * @param {string} userId - ID del usuario
   * @param {string} roomId - ID de la habitación
   * @param {string} action - Acción (view, book, rate, abandon)
   * @param {object} data - Datos adicionales
   */
  recordInteraction(userId, roomId, action, data = {}) {
    const interaction = {
      userId,
      roomId,
      action,
      timestamp: Date.now(),
      data // rating, duration, price_impact, etc
    };

    // Almacenar interacción
    if (!this.interactionHistory.has(userId)) {
      this.interactionHistory.set(userId, []);
    }
    this.interactionHistory.get(userId).push(interaction);

    // Actualizar preferencias del usuario
    this._updateUserPreferences(userId);

    // Actualizar matriz colaborativa
    this._updateCollaborativeMatrix();

    return interaction;
  }

  /**
   * Obtener recomendaciones basadas en contenido
   * @param {string} roomId - ID de referencia
   * @param {number} count - Número de recomendaciones
   * @param {number} maxPrice - Precio máximo (opcional)
   * @returns {array} Array de recomendaciones ordenadas
   */
  getContentBasedRecommendations(roomId, count = 5, maxPrice = null) {
    const referenceRoom = this.roomProfiles.get(roomId);
    if (!referenceRoom) return [];

    const recommendations = [];

    for (const [compRoomId, compRoom] of this.roomProfiles) {
      if (compRoomId === roomId) continue; // Excluir la misma habitación

      if (maxPrice && compRoom.price > maxPrice) continue; // Filtrar por precio

      // Calcular similaridad de contenido
      const similarity = this._calculateContentSimilarity(referenceRoom, compRoom);

      recommendations.push({
        roomId: compRoomId,
        similarity: similarity.toFixed(3),
        reason: this._generateRecommendationReason(referenceRoom, compRoom, similarity),
        room: compRoom
      });
    }

    // Ordenar por similaridad y limitar
    return recommendations
      .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity))
      .slice(0, count);
  }

  /**
   * Obtener recomendaciones colaborativas
   * @param {string} userId - ID del usuario
   * @param {number} count - Número de recomendaciones
   * @returns {array} Array de recomendaciones
   */
  getCollaborativeRecommendations(userId, count = 5) {
    const userHistory = this.interactionHistory.get(userId);
    if (!userHistory || userHistory.length === 0) {
      // Sin historial: retornar recomendaciones populares
      return this._getPopularRecommendations(count);
    }

    // Encontrar usuarios similares
    const similarUsers = this._findSimilarUsers(userId, 10);
    if (similarUsers.length === 0) {
      return this._getPopularRecommendations(count);
    }

    // Obtener habitaciones que les gustaron a usuarios similares
    const recommendations = new Map();

    for (const { userId: similarUserId, similarity } of similarUsers) {
      const similarUserHistory = this.interactionHistory.get(similarUserId) || [];

      for (const interaction of similarUserHistory) {
        if (interaction.action === 'book' || 
            (interaction.action === 'rate' && interaction.data.rating >= 4)) {
          
          // No recomendar lo que ya vio/bookeo el usuario
          if (!userHistory.some(h => h.roomId === interaction.roomId)) {
            const key = interaction.roomId;
            const current = recommendations.get(key) || { 
              roomId: key, 
              score: 0, 
              supporters: 0 
            };
            
            current.score += similarity * (interaction.action === 'book' ? 1.5 : 1.0);
            current.supporters += 1;
            recommendations.set(key, current);
          }
        }
      }
    }

    // Ordenar por score
    return Array.from(recommendations.values())
      .map(rec => ({
        ...rec,
        score: rec.score.toFixed(3),
        room: this.roomProfiles.get(rec.roomId),
        supporters: rec.supporters
      }))
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, count);
  }

  /**
   * Obtener recomendaciones híbridas (contenido + colaborativo)
   * @param {string} userId - ID del usuario
   * @param {string} roomId - ID de habitación de referencia (opcional)
   * @param {number} count - Número de recomendaciones
   * @returns {array} Recomendaciones híbridas combinadas
   */
  getHybridRecommendations(userId, roomId = null, count = 5) {
    const contentRecs = roomId 
      ? this.getContentBasedRecommendations(roomId, count * 2)
      : [];

    const collaborativeRecs = this.getCollaborativeRecommendations(userId, count * 2);

    // Combinar puntajes
    const combined = new Map();

    // Agregar puntuaciones de contenido
    for (let i = 0; i < contentRecs.length; i++) {
      const rec = contentRecs[i];
      const score = (contentRecs.length - i) / contentRecs.length; // Ranking to score
      
      if (!combined.has(rec.roomId)) {
        combined.set(rec.roomId, {
          roomId: rec.roomId,
          contentScore: score,
          collaborativeScore: 0,
          room: rec.room,
          reasons: []
        });
      }
      
      combined.get(rec.roomId).contentScore = score;
      combined.get(rec.roomId).reasons.push(rec.reason);
    }

    // Agregar puntuaciones colaborativas
    for (let i = 0; i < collaborativeRecs.length; i++) {
      const rec = collaborativeRecs[i];
      const score = (collaborativeRecs.length - i) / collaborativeRecs.length;
      
      if (!combined.has(rec.roomId)) {
        combined.set(rec.roomId, {
          roomId: rec.roomId,
          contentScore: 0,
          collaborativeScore: score,
          room: this.roomProfiles.get(rec.roomId),
          reasons: []
        });
      } else {
        combined.get(rec.roomId).collaborativeScore = score;
      }
    }

    // Calcular puntuación híbrida (ponderada)
    const hybridRecs = Array.from(combined.values())
      .map(rec => ({
        ...rec,
        hybridScore: (0.4 * rec.contentScore + 0.6 * rec.collaborativeScore).toFixed(3),
        contentWeight: '40%',
        collaborativeWeight: '60%'
      }))
      .sort((a, b) => parseFloat(b.hybridScore) - parseFloat(a.hybridScore))
      .slice(0, count);

    return hybridRecs;
  }

  /**
   * Obtener recomendaciones personalizadas
   * @param {string} userId - ID del usuario
   * @param {object} preferences - Preferencias específicas
   * @param {number} count - Número de recomendaciones
   * @returns {array} Habitaciones recomendadas
   */
  getPersonalizedRecommendations(userId, preferences = {}, count = 5) {
    const userPrefs = this.userPreferences.get(userId) || {};
    const mergedPrefs = { ...userPrefs, ...preferences };

    const scored = [];

    for (const [roomId, room] of this.roomProfiles) {
      // Excluir habitaciones vistas recientemente
      const userHistory = this.interactionHistory.get(userId) || [];
      if (userHistory.some(h => h.roomId === roomId && 
          Date.now() - h.timestamp < 7 * 24 * 60 * 60 * 1000)) {
        continue;
      }

      let score = 0;

      // Preferencia de tipo
      if (mergedPrefs.preferredType && room.type === mergedPrefs.preferredType) {
        score += 25;
      }

      // Rango de precio
      if (mergedPrefs.priceRange) {
        const { min = 0, max = 1000 } = mergedPrefs.priceRange;
        if (room.price >= min && room.price <= max) {
          score += 25;
        }
      }

      // Amenities deseados
      if (mergedPrefs.desiredAmenities) {
        const matchCount = mergedPrefs.desiredAmenities.filter(
          a => room.amenities.includes(a)
        ).length;
        score += matchCount * 5;
      }

      // Capacidad mínima
      if (mergedPrefs.minCapacity && room.capacity >= mergedPrefs.minCapacity) {
        score += 15;
      }

      // Rating mínimo
      if (mergedPrefs.minRating && room.rating >= mergedPrefs.minRating) {
        score += 10;
      }

      // Piso (preferencia por pisos altos)
      if (mergedPrefs.preferHighFloor && room.floor >= 3) {
        score += 10;
      }

      // Vista preferida
      if (mergedPrefs.preferredView && room.views === mergedPrefs.preferredView) {
        score += 10;
      }

      if (score > 0) {
        scored.push({
          roomId,
          score: score.toFixed(0),
          room,
          matchedCriteria: this._getMatchedCriteria(room, mergedPrefs)
        });
      }
    }

    return scored
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, count);
  }

  /**
   * Calcular similitud de contenido entre habitaciones
   * @private
   */
  _calculateContentSimilarity(room1, room2) {
    let similarity = 0;
    let factors = 0;

    // Tipo: 0 o 1
    if (room1.type === room2.type) {
      similarity += 20;
    }
    factors += 20;

    // Precio: inversamente proporcional (máximo 20 puntos)
    const priceDiff = Math.abs(room1.price - room2.price);
    const priceMax = Math.max(room1.price, room2.price);
    const priceScore = Math.max(0, 20 * (1 - priceDiff / priceMax));
    similarity += priceScore;
    factors += 20;

    // Amenities: Jaccard similarity
    const amenSet1 = new Set(room1.amenities);
    const amenSet2 = new Set(room2.amenities);
    const intersection = new Set([...amenSet1].filter(a => amenSet2.has(a)));
    const union = new Set([...amenSet1, ...amenSet2]);
    const amenScore = union.size > 0 ? (intersection.size / union.size) * 20 : 0;
    similarity += amenScore;
    factors += 20;

    // Capacidad: similar si diferencia <= 2
    if (Math.abs(room1.capacity - room2.capacity) <= 2) {
      similarity += 15;
    }
    factors += 15;

    // Rating: similar si diferencia <= 0.5
    if (Math.abs(room1.rating - room2.rating) <= 0.5) {
      similarity += 15;
    }
    factors += 15;

    // Vista: 0 o 1
    if (room1.views === room2.views) {
      similarity += 10;
    }
    factors += 10;

    return (similarity / factors) * 100;
  }

  /**
   * Encontrar usuarios similares
   * @private
   */
  _findSimilarUsers(userId, maxUsers) {
    const userHistory = this.interactionHistory.get(userId);
    if (!userHistory || userHistory.length === 0) {
      return [];
    }

    const userRooms = new Set(userHistory.map(h => h.roomId));
    const similarUsers = [];

    for (const [otherUserId, otherHistory] of this.interactionHistory) {
      if (otherUserId === userId) continue;

      const otherRooms = new Set(otherHistory.map(h => h.roomId));

      // Jaccard similarity
      const intersection = new Set([...userRooms].filter(r => otherRooms.has(r)));
      const union = new Set([...userRooms, ...otherRooms]);

      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0) {
        similarUsers.push({
          userId: otherUserId,
          similarity: similarity.toFixed(3)
        });
      }
    }

    return similarUsers
      .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity))
      .slice(0, maxUsers);
  }

  /**
   * Obtener recomendaciones populares
   * @private
   */
  _getPopularRecommendations(count) {
    const scored = [];

    for (const [roomId, room] of this.roomProfiles) {
      // Contar bookings
      let bookings = 0;
      let avgRating = 0;
      let ratings = 0;

      for (const userHistory of this.interactionHistory.values()) {
        for (const interaction of userHistory) {
          if (interaction.roomId === roomId) {
            if (interaction.action === 'book') {
              bookings += 1;
            }
            if (interaction.action === 'rate' && interaction.data.rating) {
              avgRating += interaction.data.rating;
              ratings += 1;
            }
          }
        }
      }

      avgRating = ratings > 0 ? avgRating / ratings : room.rating;

      scored.push({
        roomId,
        score: (bookings * 0.6 + avgRating * 10 * 0.4).toFixed(0),
        room,
        bookings,
        avgRating: avgRating.toFixed(1),
        popularity: 'high'
      });
    }

    return scored
      .filter(s => parseFloat(s.score) > 0)
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, count);
  }

  /**
   * Actualizar preferencias del usuario
   * @private
   */
  _updateUserPreferences(userId) {
    const history = this.interactionHistory.get(userId) || [];
    if (history.length === 0) return;

    const bookedRooms = history
      .filter(h => h.action === 'book')
      .map(h => this.roomProfiles.get(h.roomId))
      .filter(r => r);

    if (bookedRooms.length === 0) {
      this.userPreferences.set(userId, {});
      return;
    }

    // Calcular preferencias basadas en bookings
    const types = bookedRooms.map(r => r.type);
    const prices = bookedRooms.map(r => r.price);
    const capacities = bookedRooms.map(r => r.capacity);
    const views = bookedRooms.map(r => r.views);

    const preferences = {
      preferredType: this._mostFrequent(types),
      avgPrice: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(0),
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices)
      },
      preferredCapacity: Math.round(capacities.reduce((a, b) => a + b, 0) / capacities.length),
      preferredView: this._mostFrequent(views),
      desiredAmenities: this._getMostCommonAmenities(bookedRooms, 3),
      totalBookings: history.filter(h => h.action === 'book').length
    };

    this.userPreferences.set(userId, preferences);
  }

  /**
   * Generar razón de recomendación
   * @private
   */
  _generateRecommendationReason(refRoom, compRoom, similarity) {
    const reasons = [];

    if (refRoom.type === compRoom.type) {
      reasons.push(`Similar type (${compRoom.type})`);
    }

    const priceDiff = Math.abs(refRoom.price - compRoom.price);
    if (priceDiff < 20) {
      reasons.push(`Comparable price ($${compRoom.price})`);
    }

    const commonAmenities = refRoom.amenities.filter(a => compRoom.amenities.includes(a));
    if (commonAmenities.length > 0) {
      reasons.push(`Shared amenities: ${commonAmenities.slice(0, 2).join(', ')}`);
    }

    if (compRoom.rating > 4.5) {
      reasons.push(`Highly rated (${compRoom.rating}★)`);
    }

    return reasons.join(' • ') || 'Recommended match';
  }

  /**
   * Obtener criterios coincidentes
   * @private
   */
  _getMatchedCriteria(room, preferences) {
    const matched = [];

    if (preferences.preferredType && room.type === preferences.preferredType) {
      matched.push('Preferred type');
    }

    if (preferences.priceRange) {
      const { min = 0, max = 1000 } = preferences.priceRange;
      if (room.price >= min && room.price <= max) {
        matched.push('Within budget');
      }
    }

    if (preferences.desiredAmenities) {
      const matchCount = preferences.desiredAmenities.filter(
        a => room.amenities.includes(a)
      ).length;
      if (matchCount > 0) {
        matched.push(`Has ${matchCount} desired amenities`);
      }
    }

    if (preferences.minCapacity && room.capacity >= preferences.minCapacity) {
      matched.push(`Fits ${room.capacity} guests`);
    }

    if (preferences.minRating && room.rating >= preferences.minRating) {
      matched.push(`Meets rating requirement`);
    }

    return matched;
  }

  /**
   * Valor más frecuente
   * @private
   */
  _mostFrequent(arr) {
    if (arr.length === 0) return null;
    const freq = {};
    for (const val of arr) {
      freq[val] = (freq[val] || 0) + 1;
    }
    return Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
  }

  /**
   * Amenities más comunes
   * @private
   */
  _getMostCommonAmenities(rooms, count) {
    const amenCount = {};
    for (const room of rooms) {
      for (const amenity of room.amenities) {
        amenCount[amenity] = (amenCount[amenity] || 0) + 1;
      }
    }

    return Object.entries(amenCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([amenity]) => amenity);
  }

  /**
   * Actualizar matrices de similaridad
   * @private
   */
  _updateContentSimilarities() {
    // Precalcular similaridades
    for (const [roomId1, room1] of this.roomProfiles) {
      const similarities = {};
      for (const [roomId2, room2] of this.roomProfiles) {
        if (roomId1 !== roomId2) {
          similarities[roomId2] = this._calculateContentSimilarity(room1, room2);
        }
      }
      this.contentMatrix.set(roomId1, similarities);
    }
  }

  /**
   * Actualizar matriz colaborativa
   * @private
   */
  _updateCollaborativeMatrix() {
    // Precalcular similaridades usuario-usuario
    for (const userId of this.interactionHistory.keys()) {
      const similarUsers = this._findSimilarUsers(userId, 50);
      this.collaborativeMatrix.set(userId, similarUsers);
    }
  }

  /**
   * Obtener estadísticas
   */
  getStatistics() {
    return {
      totalRooms: this.roomProfiles.size,
      totalUsers: this.interactionHistory.size,
      totalInteractions: Array.from(this.interactionHistory.values())
        .reduce((sum, arr) => sum + arr.length, 0),
      interactionTypes: this._countInteractionTypes(),
      avgRoomRating: this._calculateAvgRating(),
      topRatedRooms: this._getTopRatedRooms(5)
    };
  }

  _countInteractionTypes() {
    const types = {};
    for (const history of this.interactionHistory.values()) {
      for (const interaction of history) {
        types[interaction.action] = (types[interaction.action] || 0) + 1;
      }
    }
    return types;
  }

  _calculateAvgRating() {
    const ratings = [];
    for (const [, room] of this.roomProfiles) {
      ratings.push(room.rating);
    }
    return ratings.length > 0 
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : 0;
  }

  _getTopRatedRooms(count) {
    return Array.from(this.roomProfiles.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, count)
      .map(r => ({ roomId: r.roomId, rating: r.rating, type: r.type }));
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.roomProfiles.size > 0 ? 'healthy' : 'degraded',
      roomsManaged: this.roomProfiles.size,
      usersTracked: this.interactionHistory.size,
      matrixesComputed: {
        content: this.contentMatrix.size,
        collaborative: this.collaborativeMatrix.size
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Limpiar todos los datos
   */
  clear() {
    this.roomProfiles.clear();
    this.userPreferences.clear();
    this.interactionHistory.clear();
    this.recommendations.clear();
    this.collaborativeMatrix.clear();
    this.contentMatrix.clear();
  }
}

export default RecommendationService;
