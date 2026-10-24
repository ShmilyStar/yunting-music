#import "CryptoModule.h"
#include <stddef.h>
#import <CommonCrypto/CommonDigest.h>

// lxcore-crypto C ABI（见 rust/lxcore/lxcore-crypto/src/ffi.rs）：
// 入参 NUL 结尾 UTF-8；返回缓冲长度经 out_len 给出，用 lx_free_string 释放；
// 任何错误返回空串（长度 0），不返回 null。
extern char *lx_aes_encrypt(const char *data, const char *key, const char *iv, const char *mode, size_t *out_len);
extern char *lx_aes_decrypt(const char *data, const char *key, const char *iv, const char *mode, size_t *out_len);
extern char *lx_rsa_encrypt(const char *data, const char *key, const char *padding, size_t *out_len);
extern char *lx_rsa_decrypt(const char *data, const char *key, const char *padding, size_t *out_len);
extern char *lx_generate_rsa_key_json(size_t *out_len);
extern void lx_free_string(char *ptr, size_t len);
extern const char *lx_core_version(void);

// 连接性探测：启动时调一次 `lx_core_version()`，链接阶段就能发现静态库缺失
// （原来只声明不使用，这个符号等于没有用上）
__attribute__((constructor))
static void LxProbeCore(void)
{
  const char *version = lx_core_version();
  if (version == NULL) {
    NSLog(@"[CryptoModule] lxcore_crypto 版本探测失败：静态库可能未正确链接");
  }
}

static NSString *LxTakeString(char *ptr, size_t len)
{
  if (ptr == NULL) return @"";
  NSString *result = [[NSString alloc] initWithBytes:ptr length:len encoding:NSUTF8StringEncoding];
  lx_free_string(ptr, len);
  return result != nil ? result : @"";
}

typedef char *(*LxAesFn)(const char *, const char *, const char *, const char *, size_t *);
typedef char *(*LxRsaFn)(const char *, const char *, const char *, size_t *);

static NSString *LxCallAes(LxAesFn fn, NSString *data, NSString *key, NSString *iv, NSString *mode)
{
  size_t len = 0;
  char *ptr = fn([data UTF8String], [key UTF8String], [iv UTF8String], [mode UTF8String], &len);
  return LxTakeString(ptr, len);
}

static NSString *LxCallRsa(LxRsaFn fn, NSString *data, NSString *key, NSString *padding)
{
  size_t len = 0;
  char *ptr = fn([data UTF8String], [key UTF8String], [padding UTF8String], &len);
  return LxTakeString(ptr, len);
}

@implementation CryptoModule

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

#pragma mark - AES（同步语义供音源请求路径直接使用）

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesEncryptSync:(NSString *)data key:(NSString *)key vi:(NSString *)iv mode:(NSString *)mode)
{
  return LxCallAes(lx_aes_encrypt, data, key, iv, mode);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesDecryptSync:(NSString *)data key:(NSString *)key vi:(NSString *)iv mode:(NSString *)mode)
{
  return LxCallAes(lx_aes_decrypt, data, key, iv, mode);
}

RCT_EXPORT_METHOD(aesEncrypt:(NSString *)data key:(NSString *)key vi:(NSString *)iv mode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(LxCallAes(lx_aes_encrypt, data, key, iv, mode));
}

RCT_EXPORT_METHOD(aesDecrypt:(NSString *)data key:(NSString *)key vi:(NSString *)iv mode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(LxCallAes(lx_aes_decrypt, data, key, iv, mode));
}

#pragma mark - RSA

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaEncryptSync:(NSString *)data key:(NSString *)key padding:(NSString *)padding)
{
  return LxCallRsa(lx_rsa_encrypt, data, key, padding);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaDecryptSync:(NSString *)data key:(NSString *)key padding:(NSString *)padding)
{
  return LxCallRsa(lx_rsa_decrypt, data, key, padding);
}

RCT_EXPORT_METHOD(rsaEncrypt:(NSString *)data key:(NSString *)key padding:(NSString *)padding
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(LxCallRsa(lx_rsa_encrypt, data, key, padding));
}

RCT_EXPORT_METHOD(rsaDecrypt:(NSString *)data key:(NSString *)key padding:(NSString *)padding
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(LxCallRsa(lx_rsa_decrypt, data, key, padding));
}

RCT_EXPORT_METHOD(generateRsaKey:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  size_t len = 0;
  char *ptr = lx_generate_rsa_key_json(&len);
  NSString *json = LxTakeString(ptr, len);
  NSData *jsonData = [json dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = jsonData != nil ? [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:nil] : nil;
  if ([parsed isKindOfClass:[NSDictionary class]] && parsed[@"publicKey"] != nil && parsed[@"privateKey"] != nil) {
    resolve(parsed);
  } else {
    reject(@"keygen_failed", @"RSA key generation failed", nil);
  }
}

/**
 * SHA-1 摘要（小写十六进制）。
 *
 * 与 Android 侧 `CryptoModule.java` 的 sha1 保持同一输出格式：QQ 音乐源的
 * 请求签名链（`src/utils/musicSdk/tx/utils/crypto.js` → `signRequest`）依赖它，
 * 之前 iOS 侧没导出这个方法，导致 tx 源的搜索 / 取链全部 reject 并被上层
 * 吞成「没有结果」——即 iOS 上 QQ 音乐源整体不可用。
 */
RCT_EXPORT_METHOD(sha1:(NSString *)input
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (input == nil) {
    reject(@"SHA1_ERROR", @"input is nil", nil);
    return;
  }
  NSData *data = [input dataUsingEncoding:NSUTF8StringEncoding];
  if (data == nil) {
    reject(@"SHA1_ERROR", @"input encoding failed", nil);
    return;
  }
  unsigned char digest[CC_SHA1_DIGEST_LENGTH];
  CC_SHA1(data.bytes, (CC_LONG)data.length, digest);
  NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA1_DIGEST_LENGTH * 2];
  for (int i = 0; i < CC_SHA1_DIGEST_LENGTH; i++) {
    [hex appendFormat:@"%02x", digest[i]];
  }
  resolve(hex);
}

@end
