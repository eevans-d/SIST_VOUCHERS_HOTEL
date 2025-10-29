/**
 * Ownership Validation Service
 * Verify user owns/can access resource
 */

export class OwnershipValidator {
  constructor(database) {
    this.db = database;
  }

  /**
   * Check if user owns a voucher
   */
  async isVoucherOwner(userId, voucherId) {
    try {
      const voucher = await this.db.get(
        'SELECT owner_id FROM vouchers WHERE id = ?',
        [voucherId]
      );

      if (!voucher) return false;
      return voucher.owner_id === userId;
    } catch (error) {
      console.error('❌ Voucher ownership check failed:', error);
      return false;
    }
  }

  /**
   * Check if user owns an order
   */
  async isOrderOwner(userId, orderId) {
    try {
      const order = await this.db.get(
        'SELECT user_id FROM orders WHERE id = ?',
        [orderId]
      );

      if (!order) return false;
      return order.user_id === userId;
    } catch (error) {
      console.error('❌ Order ownership check failed:', error);
      return false;
    }
  }

  /**
   * Check if user owns a stay
   */
  async isStayOwner(userId, stayId) {
    try {
      const stay = await this.db.get(
        'SELECT user_id FROM stays WHERE id = ?',
        [stayId]
      );

      if (!stay) return false;
      return stay.user_id === userId;
    } catch (error) {
      console.error('❌ Stay ownership check failed:', error);
      return false;
    }
  }

  /**
   * Check if user is admin or resource owner
   */
  async isAdminOrOwner(userId, userRole, resourceOwnerId) {
    return userRole === 'admin' || userId === resourceOwnerId;
  }

  /**
   * Validate multiple resources
   */
  async validateOwnership(userId, resourceType, resourceIds) {
    const method = `is${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}Owner`;

    if (typeof this[method] !== 'function') {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    const results = await Promise.all(
      resourceIds.map(id => this[method](userId, id))
    );

    return results;
  }
}

export const ownershipValidator = new OwnershipValidator(null);

/**
 * Middleware Factory: Require resource ownership
 */
export function requireOwnership(resourceType, resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const resourceId = req.params[resourceIdParam];

      if (!userId || !resourceId) {
        return res.status(400).json({ error: 'Missing user or resource ID' });
      }

      const isOwner = await ownershipValidator[`is${resourceType}Owner`](userId, resourceId);

      if (!isOwner) {
        return res.status(403).json({
          error: `You don't have permission to access this ${resourceType}`,
        });
      }

      next();
    } catch (error) {
      console.error('❌ Ownership validation error:', error);
      res.status(500).json({ error: 'Ownership validation failed' });
    }
  };
}

/**
 * Middleware: Allow admin or owner
 */
export function requireAdminOrOwner(resourceType, resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const resourceId = req.params[resourceIdParam];

      if (!userId || !resourceId) {
        return res.status(400).json({ error: 'Missing user or resource ID' });
      }

      // Get resource owner
      const resourceOwner = await getResourceOwner(resourceType, resourceId);

      if (!resourceOwner) {
        return res.status(404).json({ error: `${resourceType} not found` });
      }

      const isAuthorized = await ownershipValidator.isAdminOrOwner(
        userId,
        userRole,
        resourceOwner.userId || resourceOwner.ownerId
      );

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.resourceOwner = resourceOwner;
      next();
    } catch (error) {
      console.error('❌ Admin or owner validation error:', error);
      res.status(500).json({ error: 'Authorization validation failed' });
    }
  };
}

/**
 * Helper: Get resource owner ID
 */
async function getResourceOwner(resourceType, resourceId) {
  try {
    const typeMap = {
      Voucher: { table: 'vouchers', ownerField: 'owner_id' },
      Order: { table: 'orders', ownerField: 'user_id' },
      Stay: { table: 'stays', ownerField: 'user_id' },
    };

    const config = typeMap[resourceType];
    if (!config) return null;

    // Mock for demonstration - would use actual DB
    return { userId: 1 };
  } catch (error) {
    console.error(`❌ Failed to get ${resourceType} owner:`, error);
    return null;
  }
}

export default OwnershipValidator;
