from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate ,get_user_model
from rest_framework.authtoken.models import Token
from django.core.exceptions import ValidationError
from rest_framework.decorators import api_view , permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

User = get_user_model()

def _payload(user):
    token , _ = Token.objects.get_or_create(user=user)
    return {'token' : token.key, 'name':user.first_name ,'email':user.email}

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    name = str(request.data.get('name','')).strip()
    email = str(request.data.get('email','')).strip().lower()
    password = str(request.data.get('password',''))
    if not name:
       return Response({'errors':"Please tell us your name....!"},status=400)
    if not email:
       return Response({'errors':"Please enter a valid email address."},status=400)
    if User.objects.filter(username = email).exists():
       return Response({'errors':"An account with this email already exists."},status=409)
    try:
       validate_password(password)
    except ValidationError as e:
       return Response({"error":''.join(e.message)},status=400)
    user = User.objects.create_user(username=email,email=email,password=password,first_name=name)
    return Response(_payload(user),status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
   email = str(request.data.get('email','')).strip().lower()
   password = str(request.data.get('password',''))
   user =  authenticate(username = email,password = password)
   if user is None:
      return Response({'errors':'Incorrect email or password .'},status=401)
   return Response(_payload(user))

   
   