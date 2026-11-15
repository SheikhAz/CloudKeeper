import cloudinary.api
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError

TRANSFORM = 'c_fill,w_560,h_720,q_auto,f_auto'

class StorageError(Exception):
    pass

def _wrap(fn, *args, **kw):
    try:
        return fn(*args, **kw)
    except CloudinaryError as e:
        raise StorageError(str(e))
    except Exception:
        raise StorageError('Could not reach Cloudinary. Please try again.')

def verify(cloud_name, api_key, api_secret):
    _wrap(cloudinary.api.ping, cloud_name=cloud_name, api_key=api_key,
          api_secret=api_secret, timeout=30)

def upload(acc, f):
    res = _wrap(cloudinary.uploader.upload, f, resource_type='image', timeout=60,
                cloud_name=acc.cloud_name, api_key=acc.api_key, api_secret=acc.secret)
    url = res['secure_url'].replace('/upload/', f'/upload/{TRANSFORM}/', 1)
    return res['public_id'], url

def delete(acc, public_id):
    res = _wrap(cloudinary.uploader.destroy, public_id, invalidate=True, timeout=30,
                cloud_name=acc.cloud_name, api_key=acc.api_key, api_secret=acc.secret)
    # 'not found' means it is already gone, which is fine
    if res.get('result') not in ('ok', 'not found'):
        raise StorageError('Could not remove the image.')