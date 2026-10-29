FROM node:20-bookworm-slim

WORKDIR /app

# LibreOffice + fonts metrically close to Times/Arial so Vietnamese đơn headers
# (quốc hiệu, tiêu đề) do not reflow when converting DOCX → PDF on Linux.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-common \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-liberation2 \
    fonts-noto-core \
    fonts-noto-ui-core \
  && rm -rf /var/lib/apt/lists/*

# Times New Roman (Phụ lục I NĐ 30). Gói contrib tải font lúc build; lỗi mạng thì vẫn dùng Liberation Serif.
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's/Components: main/Components: main contrib/' /etc/apt/sources.list.d/debian.sources; \
    fi \
  && apt-get update \
  && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
  && apt-get install -y --no-install-recommends ttf-mscorefonts-installer \
  && rm -rf /var/lib/apt/lists/* \
  || echo "Times New Roman package unavailable; Liberation Serif remains"

COPY docker/fonts-ms-compat.conf /etc/fonts/conf.d/30-ms-compat.conf
RUN fc-cache -f -v

ENV SOFFICE_PATH=/usr/bin/soffice

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads temp logs

EXPOSE 5000

CMD ["npm", "start"]
