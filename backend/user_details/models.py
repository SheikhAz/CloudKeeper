from django.db import models
from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models

_fernet = Fernet(settings.STORAGE_ENCRYPTION_KEY.encode())

# Create your models here.
class authicate(models.Model):
    name = models.CharField(max_length=50)
    email = models.EmailField(max_length=50)

    def __str__(self):
        return self.email

class StorageAccount(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='storage')
    cloud_name = models.CharField(max_length=100)
    api_key = models.CharField(max_length=64)
    secret_enc = models.TextField()
    updated = models.DateTimeField(auto_now=True)

    @property
    def secret(self):
        return _fernet.decrypt(self.secret_enc.encode()).decode()

    @secret.setter
    def secret(self, value):
        self.secret_enc = _fernet.encrypt(value.encode()).decode()


class Photo(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='photos')
    public_id = models.CharField(max_length=255)
    url = models.URLField(max_length=600)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created']
        constraints = [models.UniqueConstraint(fields=['owner', 'public_id'], name='uniq_owner_public_id')]