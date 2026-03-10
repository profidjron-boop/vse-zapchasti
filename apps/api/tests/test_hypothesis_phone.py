from pathlib import Path
import sys

import pytest
from hypothesis import given
from hypothesis import strategies as st

sys.path.append(str(Path(__file__).resolve().parents[1]))

from schemas import normalize_phone  # noqa: E402

digit_text = st.text(alphabet="0123456789")
ten_digits = st.text(alphabet="0123456789", min_size=10, max_size=10)
eleven_digits_with_7 = st.builds(
    lambda tail: f"7{tail}",
    st.text(alphabet="0123456789", min_size=10, max_size=10),
)
eleven_digits_with_8 = st.builds(
    lambda tail: f"8{tail}",
    st.text(alphabet="0123456789", min_size=10, max_size=10),
)
invalid_lengths = digit_text.filter(lambda value: len(value) not in {10, 11})
invalid_prefix_11 = st.builds(
    lambda prefix, tail: f"{prefix}{tail}",
    st.sampled_from(["0", "1", "2", "3", "4", "5", "6", "9"]),
    st.text(alphabet="0123456789", min_size=10, max_size=10),
)


@given(ten_digits)
def test_normalize_phone_accepts_ten_digit_ru_numbers(digits: str):
    normalized = normalize_phone(digits)

    assert normalized.startswith("+7")
    assert normalized == f"+7{digits}"


@given(eleven_digits_with_7)
def test_normalize_phone_accepts_eleven_digit_numbers_starting_with_7(digits: str):
    normalized = normalize_phone(digits)

    assert normalized == f"+{digits}"


@given(eleven_digits_with_8)
def test_normalize_phone_rewrites_8_prefix_to_7(digits: str):
    normalized = normalize_phone(digits)

    assert normalized == f"+7{digits[1:]}"


@given(st.one_of(invalid_lengths, invalid_prefix_11))
def test_normalize_phone_rejects_invalid_digit_sequences(digits: str):
    with pytest.raises(ValueError, match="Phone must be a valid RU number"):
        normalize_phone(digits)
