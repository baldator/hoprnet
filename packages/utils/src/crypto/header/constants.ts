export const PRIVATE_KEY_LENGTH = 32

export const COMPRESSED_PUBLIC_KEY_LENGTH = 33
export const UNCOMPRESSED_PUBLIC_KEY_LENGTH = 65

export const HASH_ALGORITHM = 'blake2s256'
export const HASH_LENGTH = 32

export const SECRET_LENGTH = HASH_LENGTH

export const MAC_LENGTH = HASH_LENGTH

// prettier-ignore
export const BASE_POINT = Uint8Array.from([
    4, 121, 190, 102, 126, 249, 220, 187, 172,  85, 160,
   98, 149, 206, 135,  11,   7,   2, 155, 252, 219,  45,
  206,  40, 217,  89, 242, 129,  91,  22, 248,  23, 152,
   72,  58, 218, 119,  38, 163, 196, 101,  93, 164, 251,
  252,  14,  17,   8, 168, 253,  23, 180,  72, 166, 133,
   84,  25, 156,  71, 208, 143, 251,  16, 212, 184
])

export const PAYLOAD_SIZE = 500

export const END_PREFIX_LENGTH = 1
export const END_PREFIX = 0xff
