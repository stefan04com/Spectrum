from openai import OpenAI
from config import OPENAI_API_KEY

client = OpenAI(api_key=OPENAI_API_KEY)


def gen(prompt):
    """
    Generează o imagine pe baza unui prompt.
    """
    if not OPENAI_API_KEY or OPENAI_API_KEY.strip() == "":
        raise Exception("OPENAI_API_KEY is missing. Set it in your environment.")

    resp = client.images.generate(
        model="dall-e-2",   # model de imagini recomandat
        prompt=prompt,
        size="512x512"
    )
    return resp.data[0].url


def generate_avatar_and_emotions(gender, hair, skin, glasses):
    """
    Creează avatarul SAFE (NU bazat pe imaginea copilului),
    ci pe o descriere simplă + emoții diferite.
    """

    base_desc = (
        f"cute cartoon avatar of a child, {gender}, {hair}, {skin}, "
        f"{'glasses' if glasses else 'no glasses'}, simple background, soft colors"
    )

    emotion_prompts = {
        "happy": "showing a HAPPY facial expression",
        "sad": "showing a SAD facial expression",
        "angry": "showing an ANGRY facial expression",
        "scared": "showing a SCARED facial expression",
        "calm": "showing a CALM facial expression"
    }

    base_avatar = gen(base_desc)

    emotions = {
        emotion: gen(f"{base_desc}, {emotion_prompts[emotion]}")
        for emotion in emotion_prompts
    }

    return {
        "base_avatar": base_avatar,
        "emotions": emotions
    }
