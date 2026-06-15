from enum import Enum


class PSAClassification(str, Enum):
    PSOC = "psoc"
    PSIC = "psic"
    PSGC = "psgc"
    PSCC = "pscc"