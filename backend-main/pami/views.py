from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import PamiData
from .serializers import PamiDataSerializer

class PamiDataListAPIView(generics.ListAPIView):
    queryset = PamiData.objects.all()
    serializer_class = PamiDataSerializer
    permission_classes = [IsAuthenticated]
