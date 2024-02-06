#include <stdint.h>
#include <stdbool.h>
#include "sqlite3ext.h"

SQLITE_EXTENSION_INIT1


static int64_t const minMantissa = 1000000000000000ull;
static int64_t const maxMantissa = 9999999999999999ull;
static int32_t const minExponent = -96;
static int32_t const maxExponent = 80;

static int64_t const mantissaMask  = 0b111111111111111111111111111111111111111111111111111111;
static int64_t const exponentMask = 0b11111111;

static int64_t const INVALID_FLOAT = -1ll;


static bool xfl_is_negative(int64_t float1)
{
	return ((float1 >> 62U) & 1ULL) == 0;
}

static int32_t xfl_get_exponent(int64_t float1)
{
	if (float1 < 0)
		return INVALID_FLOAT;

	if (float1 == 0)
		return 0;

	if (float1 < 0) 
		return INVALID_FLOAT;

	uint64_t exponent = (uint64_t)float1;

	exponent >>= 54U;
	exponent &= 0xFFU;

	if(xfl_is_negative(float1)){
		exponent ^= exponentMask;
	}

	return (int32_t)exponent - 97;
}

static int64_t xfl_get_mantissa(int64_t float1)
{
	if (float1 < 0)
		return INVALID_FLOAT;

	if (float1 == 0)
		return 0;

	if (float1 < 0) 
		return INVALID_FLOAT;

	int64_t mantissa = float1 - ((((int64_t)float1) >> 54U) << 54U);

	if(xfl_is_negative(float1)){
		mantissa = -(mantissa ^ mantissaMask);
	}

	return mantissa;
}


static int64_t xfl_make(int64_t mantissa, int32_t exponent)
{
	if (mantissa == 0)
		return 0;

	bool neg = mantissa < 0;

	if (neg)
		mantissa *= -1;

	while (mantissa < minMantissa)
	{
		mantissa *= 10;
		exponent--;

		if (exponent < minExponent)
			return INVALID_FLOAT;
	}

	while (mantissa > maxMantissa)
	{
		mantissa /= 10;
		exponent++;

		if (exponent > maxExponent)
			return INVALID_FLOAT;
	}

	exponent = exponent - minExponent + 1;

	int64_t out = 0;

	if(neg){
		exponent = exponent ^ exponentMask;
		mantissa = mantissa ^ mantissaMask;
	}else{
		out = 1;
	}

	out <<= 8;
	out |= exponent;
	out <<= 54;
	out |= mantissa;

	return out;
}

static int64_t xfl_invert_sign(int64_t float1)
{
	return xfl_make(
		-xfl_get_mantissa(float1),
		xfl_get_exponent(float1)
	);
}

static int64_t xfl_sum(int64_t a, int64_t b)
{
	int64_t am = xfl_get_mantissa(a);
	int32_t ae = xfl_get_exponent(a);
	int64_t bm = xfl_get_mantissa(b);
	int32_t be = xfl_get_exponent(b);

	if(am == 0)
		return b;

	if(bm == 0)
		return a;

	while (ae < be){
		am /= 10;
		ae++;
	}

	while (be < ae){
		bm /= 10;
		be++;
	}

	am += bm;

	return xfl_make(am, ae);
}

static int64_t xfl_sub(int64_t a, int64_t b)
{
	return xfl_sum(a, xfl_invert_sign(b));
}




static void sum_step(sqlite3_context* ctx, int argc, sqlite3_value* argv[])
{
	if(sqlite3_value_type(argv[0]) != SQLITE_INTEGER){
		sqlite3_result_error(ctx, "xfl_sum() only works with integers", -1);
		return;
	}

	sqlite3_int64* current_sum = (sqlite3_int64*)sqlite3_aggregate_context(
		ctx,
		sizeof(sqlite3_int64)
	);

	if(current_sum){
		*current_sum = xfl_sum(
			*current_sum,
			sqlite3_value_int64(argv[0])
		);
	}
}

static void sum_inverse(sqlite3_context* ctx, int argc, sqlite3_value* argv[])
{
	sqlite3_int64* current_sum = (sqlite3_int64*)sqlite3_aggregate_context(
		ctx, 
		sizeof(sqlite3_int64)
	);
	
	*current_sum = xfl_sub(
		*current_sum,
		sqlite3_value_int64(argv[0])
	);
}

static void sum_value(sqlite3_context* ctx)
{
	sqlite3_int64* current_sum = (sqlite3_int64*)sqlite3_aggregate_context(ctx, 0);
	sqlite3_int64 value = 0;

	if(current_sum){
		value = *current_sum;
	}

	sqlite3_result_int64(ctx, value);
}


#ifdef _WIN32
__declspec(dllexport)
#endif

int sqlite3_extension_init(sqlite3* db, char** err_msg, const sqlite3_api_routines* api) {
	SQLITE_EXTENSION_INIT2(api)

	if (err_msg != 0) 
		*err_msg = 0;

	sqlite3_create_window_function(
		db,
		"xfl_sum",
		1,
		SQLITE_UTF8,
		0,
		sum_step,
		sum_value,
		sum_value,
		sum_inverse,
		0
	);
	
	return SQLITE_OK;
}
