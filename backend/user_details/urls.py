from django.urls import path
from user_details import views, photo_views

urlpatterns = [
    path('signup/', views.signup),
    path('login/', views.login),
    path('storage/', photo_views.storage),
    path('photos/', photo_views.list_photos),
    path('photos/upload/', photo_views.upload_photo),
    path('photos/<int:pk>/', photo_views.delete_photo),
    path('me/', views.me),
]