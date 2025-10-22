import { describe, it, expect, beforeEach } from 'vitest';
import RecommendationService from '../services/recommendationService.js';

describe('RecommendationService', () => {
  let service;

  beforeEach(() => {
    service = new RecommendationService();
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize empty', () => {
      expect(service.roomProfiles.size).toBe(0);
      expect(service.interactionHistory.size).toBe(0);
    });

    it('should be ready for room registration', () => {
      service.setRoomProfile('room1', { type: 'deluxe', price: 150 });
      expect(service.roomProfiles.size).toBe(1);
    });
  });

  // ===== ROOM PROFILE TESTS =====

  describe('Room Profile Management', () => {
    it('should set room profile', () => {
      const profile = service.setRoomProfile('room1', {
        type: 'deluxe',
        price: 150,
        amenities: ['wifi', 'ac'],
        capacity: 2,
        rating: 4.5
      });

      expect(profile.roomId).toBe('room1');
      expect(profile.type).toBe('deluxe');
      expect(profile.price).toBe(150);
    });

    it('should get room profile', () => {
      service.setRoomProfile('room1', { type: 'standard', price: 100 });
      const profile = service.getRoomProfile('room1');

      expect(profile).toBeDefined();
      expect(profile.type).toBe('standard');
    });

    it('should return null for non-existent room', () => {
      const profile = service.getRoomProfile('nonexistent');
      expect(profile).toBeNull();
    });

    it('should use default values', () => {
      const profile = service.setRoomProfile('room1', {});
      expect(profile.price).toBe(100);
      expect(profile.type).toBe('standard');
      expect(profile.capacity).toBe(2);
    });

    it('should multiple room profiles', () => {
      service.setRoomProfile('room1', { type: 'standard', price: 100 });
      service.setRoomProfile('room2', { type: 'deluxe', price: 150 });
      service.setRoomProfile('room3', { type: 'suite', price: 250 });

      expect(service.roomProfiles.size).toBe(3);
    });
  });

  // ===== INTERACTION RECORDING TESTS =====

  describe('Interaction Recording', () => {
    beforeEach(() => {
      service.setRoomProfile('room1', { type: 'deluxe', price: 150 });
      service.setRoomProfile('room2', { type: 'standard', price: 100 });
    });

    it('should record view interaction', () => {
      const interaction = service.recordInteraction('user1', 'room1', 'view');
      expect(interaction.action).toBe('view');
      expect(interaction.userId).toBe('user1');
      expect(interaction.roomId).toBe('room1');
    });

    it('should record book interaction', () => {
      const interaction = service.recordInteraction('user1', 'room1', 'book');
      expect(interaction.action).toBe('book');
    });

    it('should record rate interaction', () => {
      const interaction = service.recordInteraction('user1', 'room1', 'rate', {
        rating: 5
      });
      expect(interaction.data.rating).toBe(5);
    });

    it('should accumulate user interactions', () => {
      service.recordInteraction('user1', 'room1', 'view');
      service.recordInteraction('user1', 'room2', 'view');
      service.recordInteraction('user1', 'room1', 'book');

      const history = service.interactionHistory.get('user1');
      expect(history.length).toBe(3);
    });

    it('should record multiple users', () => {
      service.recordInteraction('user1', 'room1', 'book');
      service.recordInteraction('user2', 'room2', 'book');

      expect(service.interactionHistory.size).toBe(2);
    });
  });

  // ===== CONTENT-BASED FILTERING TESTS =====

  describe('Content-Based Recommendations', () => {
    beforeEach(() => {
      service.setRoomProfile('room1', {
        type: 'deluxe',
        price: 150,
        amenities: ['wifi', 'ac', 'balcony'],
        capacity: 2,
        rating: 4.5,
        views: 'sea'
      });

      service.setRoomProfile('room2', {
        type: 'deluxe',
        price: 160,
        amenities: ['wifi', 'ac', 'minibar'],
        capacity: 2,
        rating: 4.3,
        views: 'sea'
      });

      service.setRoomProfile('room3', {
        type: 'standard',
        price: 100,
        amenities: ['wifi'],
        capacity: 1,
        rating: 3.8,
        views: 'city'
      });
    });

    it('should get content-based recommendations', () => {
      const recs = service.getContentBasedRecommendations('room1', 2);
      expect(recs.length).toBeLessThanOrEqual(2);
      expect(recs[0].roomId).toBeDefined();
    });

    it('should exclude reference room', () => {
      const recs = service.getContentBasedRecommendations('room1', 5);
      expect(recs.map(r => r.roomId)).not.toContain('room1');
    });

    it('should order by similarity', () => {
      const recs = service.getContentBasedRecommendations('room1', 2);
      if (recs.length > 1) {
        expect(parseFloat(recs[0].similarity)).toBeGreaterThanOrEqual(
          parseFloat(recs[1].similarity)
        );
      }
    });

    it('should respect price filter', () => {
      const recs = service.getContentBasedRecommendations('room1', 5, 130);
      for (const rec of recs) {
        expect(rec.room.price).toBeLessThanOrEqual(130);
      }
    });

    it('should provide recommendation reason', () => {
      const recs = service.getContentBasedRecommendations('room1', 1);
      if (recs.length > 0) {
        expect(recs[0].reason).toBeDefined();
        expect(typeof recs[0].reason).toBe('string');
      }
    });
  });

  // ===== COLLABORATIVE FILTERING TESTS =====

  describe('Collaborative Recommendations', () => {
    beforeEach(() => {
      // Setup rooms
      for (let i = 1; i <= 5; i++) {
        service.setRoomProfile(`room${i}`, {
          type: i % 2 === 0 ? 'deluxe' : 'standard',
          price: 100 + i * 10,
          amenities: ['wifi'],
          capacity: 2
        });
      }

      // User1 bookings
      service.recordInteraction('user1', 'room1', 'book');
      service.recordInteraction('user1', 'room2', 'book');

      // User2 similar to User1
      service.recordInteraction('user2', 'room1', 'book');
      service.recordInteraction('user2', 'room2', 'book');
      service.recordInteraction('user2', 'room3', 'book');

      // User3 different
      service.recordInteraction('user3', 'room4', 'book');
      service.recordInteraction('user3', 'room5', 'book');
    });

    it('should get collaborative recommendations', () => {
      const recs = service.getCollaborativeRecommendations('user1', 3);
      expect(recs).toBeDefined();
      expect(Array.isArray(recs)).toBe(true);
    });

    it('should recommend rooms booked by similar users', () => {
      const recs = service.getCollaborativeRecommendations('user1', 5);
      const recRoomIds = recs.map(r => r.roomId);

      // User2 es similar a user1 y bookeo room3
      expect(recRoomIds).toContain('room3');
    });

    it('should exclude user own bookings', () => {
      const recs = service.getCollaborativeRecommendations('user1', 5);
      const recRoomIds = recs.map(r => r.roomId);

      expect(recRoomIds).not.toContain('room1');
      expect(recRoomIds).not.toContain('room2');
    });

    it('should return popular recommendations for new users', () => {
      const recs = service.getCollaborativeRecommendations('newUser', 3);
      expect(recs).toBeDefined();
      expect(Array.isArray(recs)).toBe(true);
    });

    it('should track number of supporters', () => {
      const recs = service.getCollaborativeRecommendations('user1', 5);
      if (recs.length > 0) {
        expect(recs[0].supporters).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ===== HYBRID RECOMMENDATIONS TESTS =====

  describe('Hybrid Recommendations', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        service.setRoomProfile(`room${i}`, {
          type: i % 2 === 0 ? 'deluxe' : 'standard',
          price: 100 + i * 10,
          amenities: ['wifi', 'ac'],
          capacity: 2,
          rating: 3.5 + i * 0.2
        });
      }

      // Interacciones
      service.recordInteraction('user1', 'room1', 'book');
      service.recordInteraction('user1', 'room2', 'book');
      service.recordInteraction('user2', 'room2', 'book');
      service.recordInteraction('user2', 'room3', 'book');
    });

    it('should get hybrid recommendations', () => {
      const recs = service.getHybridRecommendations('user1', 'room1', 3);
      expect(recs).toBeDefined();
    });

    it('should combine content and collaborative scores', () => {
      const recs = service.getHybridRecommendations('user1', 'room1', 3);
      if (recs.length > 0) {
        expect(recs[0].hybridScore).toBeDefined();
        expect(recs[0].contentScore).toBeDefined();
        expect(recs[0].collaborativeScore).toBeDefined();
      }
    });

    it('should show weighting information', () => {
      const recs = service.getHybridRecommendations('user1', 'room1', 1);
      if (recs.length > 0) {
        expect(recs[0].contentWeight).toBe('40%');
        expect(recs[0].collaborativeWeight).toBe('60%');
      }
    });

    it('should work with only reference room', () => {
      const recs = service.getHybridRecommendations('newUser', 'room1', 2);
      expect(recs).toBeDefined();
    });
  });

  // ===== PERSONALIZED RECOMMENDATIONS TESTS =====

  describe('Personalized Recommendations', () => {
    beforeEach(() => {
      // Setup diverse rooms
      service.setRoomProfile('room1', {
        type: 'deluxe',
        price: 200,
        amenities: ['wifi', 'ac', 'balcony', 'jacuzzi'],
        capacity: 2,
        rating: 4.8,
        floor: 5,
        views: 'sea'
      });

      service.setRoomProfile('room2', {
        type: 'standard',
        price: 80,
        amenities: ['wifi'],
        capacity: 1,
        rating: 3.5,
        floor: 2,
        views: 'city'
      });

      service.setRoomProfile('room3', {
        type: 'suite',
        price: 300,
        amenities: ['wifi', 'ac', 'balcony', 'bar'],
        capacity: 4,
        rating: 4.9,
        floor: 8,
        views: 'sea'
      });

      // User history
      service.recordInteraction('user1', 'room1', 'book');
      service.recordInteraction('user1', 'room3', 'view');
    });

    it('should get personalized recommendations', () => {
      const prefs = {
        preferredType: 'deluxe',
        minCapacity: 2,
        minRating: 4.0
      };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 3);

      expect(Array.isArray(recs)).toBe(true);
    });

    it('should match room type preference', () => {
      const prefs = { preferredType: 'deluxe' };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 5);

      const deluxeRecs = recs.filter(r => r.room.type === 'deluxe');
      expect(deluxeRecs.length).toBeGreaterThan(0);
    });

    it('should respect price range', () => {
      const prefs = { priceRange: { min: 100, max: 250 } };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 5);

      for (const rec of recs) {
        expect(rec.room.price).toBeGreaterThanOrEqual(100);
        expect(rec.room.price).toBeLessThanOrEqual(250);
      }
    });

    it('should match desired amenities', () => {
      const prefs = { desiredAmenities: ['balcony', 'jacuzzi'] };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 5);

      if (recs.length > 0) {
        const hasAmenity = recs[0].room.amenities.some(a =>
          ['balcony', 'jacuzzi'].includes(a)
        );
        expect(hasAmenity).toBe(true);
      }
    });

    it('should prefer high floor rooms', () => {
      const prefs = { preferHighFloor: true };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 5);

      const highFloorRecs = recs.filter(r => r.room.floor >= 3);
      expect(highFloorRecs.length).toBeGreaterThan(0);
    });

    it('should show matched criteria', () => {
      const prefs = { preferredType: 'deluxe', minCapacity: 2 };
      const recs = service.getPersonalizedRecommendations('user1', prefs, 5);

      if (recs.length > 0) {
        expect(recs[0].matchedCriteria).toBeDefined();
        expect(Array.isArray(recs[0].matchedCriteria)).toBe(true);
      }
    });
  });

  // ===== USER PREFERENCE INFERENCE TESTS =====

  describe('User Preference Learning', () => {
    beforeEach(() => {
      service.setRoomProfile('deluxe1', {
        type: 'deluxe',
        price: 150,
        amenities: ['wifi', 'ac', 'balcony'],
        capacity: 2
      });

      service.setRoomProfile('deluxe2', {
        type: 'deluxe',
        price: 160,
        amenities: ['wifi', 'ac', 'minibar'],
        capacity: 2
      });

      service.setRoomProfile('standard', {
        type: 'standard',
        price: 80,
        amenities: ['wifi'],
        capacity: 1
      });
    });

    it('should learn user preferences from bookings', () => {
      service.recordInteraction('user1', 'deluxe1', 'book');
      service.recordInteraction('user1', 'deluxe2', 'book');
      service.recordInteraction('user1', 'standard', 'view'); // Solo vista

      const prefs = service.userPreferences.get('user1');
      expect(prefs.preferredType).toBe('deluxe');
    });

    it('should calculate average price preference', () => {
      service.recordInteraction('user1', 'deluxe1', 'book');
      service.recordInteraction('user1', 'deluxe2', 'book');

      const prefs = service.userPreferences.get('user1');
      expect(prefs.avgPrice).toBeDefined();
      expect(prefs.priceRange.min).toBeLessThanOrEqual(prefs.priceRange.max);
    });

    it('should track booking count', () => {
      service.recordInteraction('user1', 'deluxe1', 'book');
      service.recordInteraction('user1', 'deluxe2', 'book');
      service.recordInteraction('user1', 'deluxe1', 'book');

      const prefs = service.userPreferences.get('user1');
      expect(prefs.totalBookings).toBe(3);
    });
  });

  // ===== SIMILARITY CALCULATION TESTS =====

  describe('Similarity Calculations', () => {
    it('should calculate content similarity', () => {
      service.setRoomProfile('room1', {
        type: 'deluxe',
        price: 150,
        amenities: ['wifi', 'ac'],
        capacity: 2,
        rating: 4.5
      });

      service.setRoomProfile('room2', {
        type: 'deluxe',
        price: 160,
        amenities: ['wifi', 'ac'],
        capacity: 2,
        rating: 4.3
      });

      const recs = service.getContentBasedRecommendations('room1', 1);
      const similarity = parseFloat(recs[0].similarity);

      expect(similarity).toBeGreaterThan(70);
    });

    it('should identify dissimilar rooms', () => {
      service.setRoomProfile('room1', {
        type: 'deluxe',
        price: 200,
        amenities: ['wifi', 'ac', 'balcony'],
        capacity: 2
      });

      service.setRoomProfile('room2', {
        type: 'standard',
        price: 80,
        amenities: ['wifi'],
        capacity: 1
      });

      const recs = service.getContentBasedRecommendations('room1', 1);
      const similarity = parseFloat(recs[0].similarity);

      expect(similarity).toBeLessThan(60);
    });
  });

  // ===== STATISTICS TESTS =====

  describe('Statistics', () => {
    it('should report statistics', () => {
      service.setRoomProfile('room1', {});
      service.recordInteraction('user1', 'room1', 'view');

      const stats = service.getStatistics();
      expect(stats.totalRooms).toBe(1);
      expect(stats.totalUsers).toBe(1);
    });

    it('should count interaction types', () => {
      service.setRoomProfile('room1', {});
      service.recordInteraction('user1', 'room1', 'view');
      service.recordInteraction('user1', 'room1', 'book');

      const stats = service.getStatistics();
      expect(stats.interactionTypes.view).toBe(1);
      expect(stats.interactionTypes.book).toBe(1);
    });

    it('should calculate average rating', () => {
      service.setRoomProfile('room1', { rating: 4.5 });
      service.setRoomProfile('room2', { rating: 4.7 });

      const stats = service.getStatistics();
      expect(parseFloat(stats.avgRoomRating)).toBeCloseTo(4.6, 1);
    });

    it('should list top rated rooms', () => {
      service.setRoomProfile('room1', { rating: 4.0 });
      service.setRoomProfile('room2', { rating: 4.8 });
      service.setRoomProfile('room3', { rating: 4.9 });

      const stats = service.getStatistics();
      expect(stats.topRatedRooms[0].rating).toBe(4.9);
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should report healthy status', () => {
      service.setRoomProfile('room1', {});
      const health = service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.roomsManaged).toBe(1);
    });

    it('should report degraded for empty service', () => {
      const health = service.healthCheck();
      expect(health.status).toBe('degraded');
    });

    it('should track matrices computed', () => {
      service.setRoomProfile('room1', {});
      service.setRoomProfile('room2', {});

      const health = service.healthCheck();
      expect(health.matrixesComputed.content).toBeGreaterThan(0);
    });
  });

  // ===== DATA MANAGEMENT TESTS =====

  describe('Data Management', () => {
    it('should clear all data', () => {
      service.setRoomProfile('room1', {});
      service.recordInteraction('user1', 'room1', 'view');

      expect(service.roomProfiles.size).toBeGreaterThan(0);
      service.clear();

      expect(service.roomProfiles.size).toBe(0);
      expect(service.interactionHistory.size).toBe(0);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle non-existent reference room', () => {
      const recs = service.getContentBasedRecommendations('nonexistent', 5);
      expect(recs.length).toBe(0);
    });

    it('should handle single room recommendations', () => {
      service.setRoomProfile('room1', {});
      const recs = service.getContentBasedRecommendations('room1', 1);
      expect(recs.length).toBe(0); // No hay otro para recomendar
    });

    it('should handle empty interaction history', () => {
      service.setRoomProfile('room1', {});
      const recs = service.getCollaborativeRecommendations('newUser');
      expect(recs).toBeDefined();
    });

    it('should handle extreme price ranges', () => {
      service.setRoomProfile('room1', { price: 10000 });
      service.setRoomProfile('room2', { price: 50 });

      const recs = service.getContentBasedRecommendations('room1', 1);
      expect(recs[0]).toBeDefined();
    });

    it('should handle rooms with no amenities', () => {
      service.setRoomProfile('room1', { amenities: [] });
      service.setRoomProfile('room2', { amenities: ['wifi', 'ac'] });

      const recs = service.getContentBasedRecommendations('room1', 1);
      expect(recs).toBeDefined();
    });
  });

  // ===== CONCURRENCY TESTS =====

  describe('Concurrent Operations', () => {
    it('should handle concurrent room setup', async () => {
      const promises = [];
      for (let i = 1; i <= 20; i++) {
        promises.push(
          Promise.resolve(service.setRoomProfile(`room${i}`, { price: i * 10 }))
        );
      }

      await Promise.all(promises);
      expect(service.roomProfiles.size).toBe(20);
    });

    it('should handle concurrent interactions', async () => {
      service.setRoomProfile('room1', {});

      const promises = [];
      for (let i = 1; i <= 50; i++) {
        promises.push(
          Promise.resolve(
            service.recordInteraction(`user${i}`, 'room1', 'view')
          )
        );
      }

      await Promise.all(promises);
      expect(service.interactionHistory.size).toBe(50);
    });

    it('should handle concurrent recommendations', async () => {
      service.setRoomProfile('room1', {});
      service.setRoomProfile('room2', {});

      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(
          Promise.resolve(
            service.getContentBasedRecommendations('room1', 1)
          )
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
    });
  });
});
