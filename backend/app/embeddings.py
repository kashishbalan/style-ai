import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"


@lru_cache(maxsize=1)
def _get_model() -> tuple[CLIPModel, CLIPProcessor]:
    model = CLIPModel.from_pretrained(MODEL_NAME)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model.eval()
    return model, processor


def preload_model() -> None:
    _get_model()


def embed_image(image_path: Path) -> list[float]:
    model, processor = _get_model()
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        output = model.get_image_features(**inputs)
    # newer transformers returns BaseModelOutputWithPooling instead of a raw tensor
    features = output.pooler_output if hasattr(output, "pooler_output") else output
    features = features / features.norm(p=2, dim=-1, keepdim=True)
    return features[0].tolist()


def embedding_to_json(vector: list[float]) -> str:
    return json.dumps(vector)


def embedding_from_json(raw: str) -> np.ndarray:
    return np.array(json.loads(raw), dtype=np.float32)
