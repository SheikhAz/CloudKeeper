import re
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response
from . import cloud
from .models import StorageAccount, Photo

MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
CLOUD_RE = re.compile(r'^[a-z0-9_-]{2,100}$')
KEY_RE = re.compile(r'^\d{6,20}$')

def _dto(p):
    return {'id': p.id, 'url': p.url, 'public_id': p.public_id}

def _account(user):
    return StorageAccount.objects.filter(user=user).first()

@api_view(['GET', 'POST', 'DELETE'])
@parser_classes([JSONParser])
def storage(request):
    acc = _account(request.user)

    if request.method == 'GET':
        if not acc:
            return Response({'connected': False})
        data = {
            'connected': True,
            'cloud_name': acc.cloud_name,
            'photos': request.user.photos.count(),
        }
        if request.query_params.get('check'):      # live test of the saved credentials
            try:
                cloud.verify(acc.cloud_name, acc.api_key, acc.secret)
                data['ok'] = True
            except cloud.StorageError as e:
                data['ok'] = False
                data['reason'] = str(e)
        return Response(data)

    if request.method == 'DELETE':
        if acc:
            acc.delete()   # images stay in the user's Cloudinary
        return Response(status=204)

    cloud_name = str(request.data.get('cloud_name', '')).strip().lower()
    api_key = str(request.data.get('api_key', '')).strip()
    api_secret = str(request.data.get('api_secret', '')).strip()
    if not CLOUD_RE.match(cloud_name):
        return Response({'errors': 'Cloud name looks wrong. Copy it from your Cloudinary dashboard.'}, status=400)
    if not KEY_RE.match(api_key):
        return Response({'errors': 'API key should be numbers only.'}, status=400)
    if len(api_secret) < 10:
        return Response({'errors': 'Please paste your API secret.'}, status=400)
    try:
        cloud.verify(cloud_name, api_key, api_secret)
    except cloud.StorageError as e:
        return Response({'errors': f'Cloudinary says: {e}'}, status=400)

    if acc and acc.cloud_name != cloud_name:
        request.user.photos.all().delete()   # old URLs belong to another account
    acc = acc or StorageAccount(user=request.user)
    acc.cloud_name = cloud_name
    acc.api_key = api_key
    acc.secret = api_secret
    acc.save()
    return Response({'connected': True, 'cloud_name': cloud_name})

@api_view(['GET'])
def list_photos(request):
    return Response([_dto(p) for p in request.user.photos.all()[:60]])

@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_photo(request):
    acc = _account(request.user)
    if not acc:
        return Response({'errors': 'Connect your Cloudinary account first.', 'code': 'no_storage'}, status=409)
    f = request.FILES.get('image')
    if not f:
        return Response({'errors': 'Please choose an image.'}, status=400)
    if f.content_type not in ALLOWED:
        return Response({'errors': 'Only JPG, PNG, WEBP or GIF allowed.'}, status=400)
    if f.size > MAX_BYTES:
        return Response({'errors': 'Image must be under 10 MB.'}, status=400)
    try:
        public_id, url = cloud.upload(acc, f)
    except cloud.StorageError as e:
        return Response({'errors': f'Cloudinary says: {e}'}, status=502)
    photo = Photo.objects.create(owner=request.user, public_id=public_id, url=url)
    return Response(_dto(photo), status=201)

@api_view(['DELETE'])
def delete_photo(request, pk):
    p = request.user.photos.filter(pk=pk).first()
    if not p:
        return Response(status=404)
    acc = _account(request.user)
    if acc:
        try:
            cloud.delete(acc, p.public_id)
        except cloud.StorageError as e:
            return Response({'errors': f'Cloudinary says: {e}'}, status=502)
    p.delete()
    return Response(status=204)