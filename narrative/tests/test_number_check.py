import pytest

from app.numbers import allowed_numbers, extract_numbers, format_number, unverified_numbers

ALLOWED = allowed_numbers({"value": 74.3, "target": 80.0, "deviation": -5.7, "rank": 21, "n": 23, "year": 2024})


@pytest.mark.parametrize(
    "text",
    [
        "Helsinki is 5.7 pp below the 80% target.",
        "Helsinki is 5,7 pp below the 80 % target.",  # decimal comma
        "Helsinki is 5.7% below the target of 80 pp.",  # % vs pp
        "Helsinki is 5,7 prosenttiyksikköä alle tavoitteen (80 %).",
        "Helsinki is −5.7 percentage points from target.",  # sign is a word, not part of the number
        "Helsinki ranks 21 of 23 in 2024, at 74.3%.",
        "Helsinki ranks 21/23.",
    ],
)
def test_formatting_differences_pass(text):
    assert unverified_numbers(text, ALLOWED) == []


@pytest.mark.parametrize(
    ("text", "bad"),
    [
        ("Helsinki is 6.2 pp below the 80% target.", ["6.2"]),  # invented
        ("Helsinki is 6 pp below the 80% target.", ["6"]),  # rounded 5.7 is still not 5.7
        ("Helsinki is 5.7 pp below target; about 1,200 women missed screening.", ["1,200"]),
        ("Participation fell 3 years in a row.", ["3"]),
    ],
)
def test_invented_or_rounded_numbers_fail(text, bad):
    assert unverified_numbers(text, ALLOWED) == bad


def test_numbers_inside_strings_count_as_allowed():
    allowed = allowed_numbers({"indicator": "Bowel cancer 5-year relative survival"})
    assert unverified_numbers("5-year survival", allowed) == []


def test_sentence_end_and_list_commas_are_not_decimals():
    assert extract_numbers("ranking 21, 23 and 2024.") == ["21", "23", "2024"]


@pytest.mark.parametrize(
    ("x", "lang", "out"),
    [(74.3, "en", "74.3"), (74.3, "fi", "74,3"), (80.0, "fi", "80"), (5.70, "en", "5.7"), (0.0, "en", "0")],
)
def test_format_number(x, lang, out):
    assert format_number(x, lang) == out
