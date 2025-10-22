import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CDNService, cdnMiddleware } from '../services/cdnService.js';

describe('CDNService', () => {
  let cdnService;

  beforeEach(() => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET_CDN = 'test-cdn-bucket';
    process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID = 'E123456EXAMPLE';
    process.env.AWS_CDN_DOMAIN = 'https://cdn.example.com';

    cdnService = new CDNService();
    cdnService.s3Client = {
      upload: vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          Key: 'test/file.js',
          ETag: '"abc123"',
        }),
      })),
      headObject: vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          ContentLength: 1024,
          LastModified: new Date(),
          ETag: '"abc123"',
          ContentType: 'application/javascript',
          CacheControl: 'public, max-age=86400',
        }),
      })),
      listObjects: vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          Contents: [
            { Key: 'test/file.js', Size: 1024 },
            { Key: 'test/style.css', Size: 2048 },
          ],
        }),
      })),
      deleteObject: vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({}),
      })),
    };

    cdnService.cloudfront = {
      createInvalidation: vi.fn(() => ({
        promise: vi.fn().mockResolvedValue({
          Invalidation: { Id: 'I123456789' },
        }),
      })),
    };
  });

  describe('MIME Type Detection', () => {
    it('should detect JavaScript MIME type', () => {
      const mime = cdnService.getMimeType('.js');
      expect(mime).toBe('application/javascript');
    });

    it('should detect CSS MIME type', () => {
      const mime = cdnService.getMimeType('.css');
      expect(mime).toBe('text/css');
    });

    it('should detect image MIME types', () => {
      expect(cdnService.getMimeType('.png')).toBe('image/png');
      expect(cdnService.getMimeType('.jpg')).toBe('image/jpeg');
      expect(cdnService.getMimeType('.webp')).toBe('image/webp');
      expect(cdnService.getMimeType('.svg')).toBe('image/svg+xml');
    });

    it('should detect font MIME types', () => {
      expect(cdnService.getMimeType('.woff')).toBe('font/woff');
      expect(cdnService.getMimeType('.woff2')).toBe('font/woff2');
      expect(cdnService.getMimeType('.ttf')).toBe('font/ttf');
    });

    it('should detect JSON MIME type', () => {
      const mime = cdnService.getMimeType('.json');
      expect(mime).toBe('application/json');
    });

    it('should return default MIME type for unknown extensions', () => {
      const mime = cdnService.getMimeType('.unknown');
      expect(mime).toBe('application/octet-stream');
    });
  });

  describe('Cache Control Headers', () => {
    it('should set 1-year cache for images', () => {
      const cc = cdnService.getCacheControl('image/png');
      expect(cc).toContain('31536000'); // 1 year
      expect(cc).toContain('immutable');
    });

    it('should set 1-year cache for fonts', () => {
      const cc = cdnService.getCacheControl('font/woff2');
      expect(cc).toContain('31536000');
      expect(cc).toContain('immutable');
    });

    it('should set 1-day cache for JS/CSS', () => {
      const ccJs = cdnService.getCacheControl('application/javascript');
      const ccCss = cdnService.getCacheControl('text/css');
      expect(ccJs).toContain('86400'); // 1 day
      expect(ccCss).toContain('86400');
    });

    it('should set 1-hour cache for HTML', () => {
      const cc = cdnService.getCacheControl('text/html');
      expect(cc).toContain('3600');
      expect(cc).toContain('must-revalidate');
    });

    it('should set 1-hour default cache', () => {
      const cc = cdnService.getCacheControl('application/unknown');
      expect(cc).toContain('3600');
    });
  });

  describe('Compression Detection', () => {
    it('should detect compressible formats', () => {
      expect(cdnService.shouldCompress('.js', 2000)).toBe(true);
      expect(cdnService.shouldCompress('.css', 2000)).toBe(true);
      expect(cdnService.shouldCompress('.json', 2000)).toBe(true);
      expect(cdnService.shouldCompress('.svg', 2000)).toBe(true);
    });

    it('should not compress small files', () => {
      expect(cdnService.shouldCompress('.js', 500)).toBe(false);
      expect(cdnService.shouldCompress('.css', 100)).toBe(false);
    });

    it('should not compress non-compressible formats', () => {
      expect(cdnService.shouldCompress('.png', 5000)).toBe(false);
      expect(cdnService.shouldCompress('.jpg', 5000)).toBe(false);
      expect(cdnService.shouldCompress('.webp', 5000)).toBe(false);
    });

    it('should support custom compression threshold', () => {
      const customCDN = new CDNService({ compressionThreshold: 5000 });
      expect(customCDN.shouldCompress('.js', 2000)).toBe(false);
      expect(customCDN.shouldCompress('.js', 6000)).toBe(true);
    });

    it('should get compression methods for file', () => {
      const methods = cdnService.getCompressionMethods('.js');
      expect(methods).toContain('gzip');
      expect(methods).toContain('br');
    });

    it('should return empty array for non-compressible', () => {
      const methods = cdnService.getCompressionMethods('.png');
      expect(methods).toEqual([]);
    });
  });

  describe('Asset Upload', () => {
    it('should upload asset with correct parameters', async () => {
      const result = await cdnService.uploadAsset('/test/file.js', Buffer.from('console.log("test");'));
      
      expect(result.url).toContain('cdn.example.com');
      expect(result.key).toBe('test/file.js');
      expect(result.etag).toBe('"abc123"');
    });

    it('should strip leading slash from path', async () => {
      await cdnService.uploadAsset('/assets/style.css', Buffer.from('body {}'));
      
      const callArgs = cdnService.s3Client.upload().promise.mock.results[0].value;
      expect(callArgs.Key).not.toStartWith('/');
    });

    it('should set correct cache control for images', async () => {
      await cdnService.uploadAsset('/images/photo.png', Buffer.from('PNG'));
      
      const params = cdnService.s3Client.upload.mock.calls[0][0];
      expect(params.CacheControl).toContain('31536000');
    });

    it('should add version metadata', async () => {
      await cdnService.uploadAsset('/test/file.js', Buffer.from('test'), { version: 'v1.0' });
      
      const params = cdnService.s3Client.upload.mock.calls[0][0];
      expect(params.Metadata.version).toBe('v1.0');
    });

    it('should handle upload errors', async () => {
      cdnService.s3Client.upload = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Upload failed')),
      }));

      await expect(
        cdnService.uploadAsset('/error/file.js', Buffer.from('test'))
      ).rejects.toThrow('Upload failed');
    });

    it('should compress JavaScript files', async () => {
      const largeContent = Buffer.from('var x = ' + '0;'.repeat(1000));
      await cdnService.uploadAsset('/test/large.js', largeContent);
      
      const params = cdnService.s3Client.upload.mock.calls[0][0];
      expect(params.ContentEncoding).toBeDefined();
    });

    it('should set content type correctly', async () => {
      await cdnService.uploadAsset('/test/file.json', Buffer.from('{}'));
      
      const params = cdnService.s3Client.upload.mock.calls[0][0];
      expect(params.ContentType).toBe('application/json');
    });
  });

  describe('Batch Upload', () => {
    it('should upload multiple assets', async () => {
      const assets = [
        { path: '/test/file1.js', content: Buffer.from('test1') },
        { path: '/test/file2.js', content: Buffer.from('test2') },
        { path: '/test/file3.js', content: Buffer.from('test3') },
      ];

      const results = await cdnService.uploadAssets(assets);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      let callCount = 0;
      cdnService.s3Client.upload = vi.fn(() => ({
        promise: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Upload failed'));
          }
          return Promise.resolve({ Key: 'test/file.js', ETag: '"abc"' });
        }),
      }));

      const assets = [
        { path: '/test/file1.js', content: Buffer.from('test1') },
        { path: '/test/file2.js', content: Buffer.from('test2') },
        { path: '/test/file3.js', content: Buffer.from('test3') },
      ];

      const results = await cdnService.uploadAssets(assets);
      
      expect(results).toHaveLength(3);
      expect(results.filter(r => r.success).length).toBe(2);
      expect(results.filter(r => !r.success).length).toBe(1);
    });
  });

  describe('CloudFront Invalidation', () => {
    it('should invalidate single path', async () => {
      const id = await cdnService.invalidateCache(['/assets/file.js']);
      
      expect(id).toBe('I123456789');
      expect(cdnService.cloudfront.createInvalidation).toHaveBeenCalled();
    });

    it('should invalidate multiple paths', async () => {
      const paths = ['/assets/file1.js', '/assets/file2.css', '/images/photo.png'];
      await cdnService.invalidateCache(paths);
      
      const params = cdnService.cloudfront.createInvalidation.mock.calls[0][0];
      expect(params.InvalidationBatch.Paths.Quantity).toBe(3);
    });

    it('should invalidate pattern', async () => {
      await cdnService.invalidatePattern('/assets/*');
      
      const params = cdnService.cloudfront.createInvalidation.mock.calls[0][0];
      expect(params.InvalidationBatch.Paths.Items[0]).toBe('/assets/*');
    });

    it('should handle missing CloudFront distribution', async () => {
      cdnService.cloudfrontDistribution = null;
      
      const result = await cdnService.invalidateCache(['/test/file.js']);
      expect(result).toBeNull();
    });

    it('should handle invalidation errors', async () => {
      cdnService.cloudfront.createInvalidation = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Invalid distribution')),
      }));

      await expect(
        cdnService.invalidateCache(['/test/file.js'])
      ).rejects.toThrow('Invalid distribution');
    });
  });

  describe('Asset URLs', () => {
    it('should generate CDN URL with leading slash', () => {
      const url = cdnService.getAssetUrl('assets/file.js');
      expect(url).toBe('https://cdn.example.com/assets/file.js');
    });

    it('should handle paths with leading slash', () => {
      const url = cdnService.getAssetUrl('/assets/file.js');
      expect(url).toBe('https://cdn.example.com/assets/file.js');
    });

    it('should work with nested paths', () => {
      const url = cdnService.getAssetUrl('vendor/lib/module.js');
      expect(url).toContain('cdn.example.com');
      expect(url).toContain('vendor/lib/module.js');
    });
  });

  describe('Asset Metadata', () => {
    it('should get asset metadata', async () => {
      const metadata = await cdnService.getAssetMetadata('/test/file.js');
      
      expect(metadata.size).toBe(1024);
      expect(metadata.etag).toBe('"abc123"');
      expect(metadata.contentType).toBe('application/javascript');
    });

    it('should handle metadata errors', async () => {
      cdnService.s3Client.headObject = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Not found')),
      }));

      const metadata = await cdnService.getAssetMetadata('/nonexistent/file.js');
      expect(metadata).toBeNull();
    });
  });

  describe('Asset Deletion', () => {
    it('should delete asset from S3', async () => {
      await cdnService.deleteAsset('/test/file.js');
      
      expect(cdnService.s3Client.deleteObject).toHaveBeenCalled();
    });

    it('should invalidate CloudFront after deletion', async () => {
      await cdnService.deleteAsset('/test/file.js');
      
      expect(cdnService.cloudfront.createInvalidation).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      cdnService.s3Client.deleteObject = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('Delete failed')),
      }));

      await expect(
        cdnService.deleteAsset('/test/file.js')
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('CDN Stats', () => {
    it('should get CDN statistics', async () => {
      const stats = await cdnService.getStats();
      
      expect(stats.totalAssets).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.totalCompressed).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeDefined();
      expect(stats.cdnDomain).toBe('https://cdn.example.com');
    });

    it('should handle stats errors', async () => {
      cdnService.s3Client.listObjects = vi.fn(() => ({
        promise: vi.fn().mockRejectedValue(new Error('List error')),
      }));

      const stats = await cdnService.getStats();
      expect(stats).toBeNull();
    });
  });

  describe('Middleware', () => {
    it('should skip non-asset paths', () => {
      const req = { path: '/api/users' };
      const res = { set: vi.fn() };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
    });

    it('should process JavaScript assets', () => {
      const req = { path: '/assets/app.js' };
      const res = { set: vi.fn() };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should process CSS assets', () => {
      const req = { path: '/styles/main.css' };
      const res = { set: vi.fn() };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalled();
    });

    it('should process image assets', () => {
      const req = { path: '/images/logo.png' };
      const res = { set: vi.fn() };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalled();
    });

    it('should set CDN URL header', () => {
      const req = { path: '/fonts/arial.woff2' };
      const res = { set: vi.fn() };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-CDN-URL', expect.stringContaining('cdn.example.com'));
    });

    it('should handle middleware errors gracefully', () => {
      const req = { path: '/assets/app.js' };
      const res = { set: vi.fn(() => { throw new Error('Set failed'); }) };
      const next = vi.fn();

      cdnMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should generate asset URLs in < 5ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        cdnService.getAssetUrl(`/assets/file${i}.js`);
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5);
    });

    it('should detect MIME types in < 2ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        cdnService.getMimeType('.js');
        cdnService.getMimeType('.css');
        cdnService.getMimeType('.png');
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(2);
    });

    it('should get cache control headers in < 2ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        cdnService.getCacheControl('application/javascript');
        cdnService.getCacheControl('image/png');
        cdnService.getCacheControl('text/css');
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file paths', async () => {
      const result = await cdnService.uploadAsset('', Buffer.from('test'));
      expect(result.key).toBeDefined();
    });

    it('should handle very long file paths', () => {
      const longPath = '/assets/' + 'a'.repeat(500) + '.js';
      const url = cdnService.getAssetUrl(longPath);
      expect(url).toContain('cdn.example.com');
    });

    it('should handle special characters in paths', () => {
      const specialPath = '/assets/file-name_123.js';
      const url = cdnService.getAssetUrl(specialPath);
      expect(url).toContain('file-name_123');
    });

    it('should handle concurrent metadata requests', async () => {
      const paths = ['/file1.js', '/file2.css', '/file3.png'];
      const results = await Promise.all(
        paths.map(p => cdnService.getAssetMetadata(p))
      );
      expect(results).toHaveLength(3);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should handle undefined CloudFront config gracefully', async () => {
      const service = new CDNService();
      service.cloudfrontDistribution = undefined;
      
      const result = await service.invalidateCache(['/test/file.js']);
      expect(result).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for config', () => {
      expect(cdnService.bucket).toBe('test-cdn-bucket');
      expect(cdnService.cloudfrontDistribution).toBe('E123456EXAMPLE');
      expect(cdnService.cdnDomain).toBe('https://cdn.example.com');
    });

    it('should use default values when env vars not set', () => {
      delete process.env.AWS_S3_BUCKET_CDN;
      delete process.env.AWS_CDN_DOMAIN;
      
      const service = new CDNService();
      expect(service.bucket).toBe('cdn-bucket');
      expect(service.cdnDomain).toContain('s3.amazonaws.com');
    });

    it('should allow custom compression threshold', () => {
      const service = new CDNService({ compressionThreshold: 5000 });
      expect(service.compressionThreshold).toBe(5000);
    });
  });
});
