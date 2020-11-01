# hsb_cacert.pem - Hue Sync Box CA Certificate

`hsb_cacert.pem` is the CA certificate for the Hue Sync Box.

The file was downloaded from  https://developers.meethue.com/wp-content/uploads/2020/01/hsb_cacert.pem_.txt on 2020-11-01.

Its use is described at https://developers.meethue.com/develop/hue-entertainment/hue-hdmi-sync-box-api/.

## Making a CURL Request to a Hue Sync Box with Certificate Checks
```
curl --cacert hsb_cacert.pem -H "Authorization: Bearer ${token}" -X GET https://${id}/api/v1 --resolve "${id}:443:${ip}"
```

## The Hue Sync Box Signing Certificate

```
openssl x509 -in certificates/hsb_cacert.pem -text
```

```
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 1 (0x1)
    Signature Algorithm: ecdsa-with-SHA256
        Issuer: C=NL, O=Philips Hue, CN=root-hsb
        Validity
            Not Before: Jan  1 00:00:00 2017 GMT
            Not After : Dec 31 23:59:59 9999 GMT
        Subject: C=NL, O=Philips Hue, CN=root-hsb
        Subject Public Key Info:
            Public Key Algorithm: id-ecPublicKey
                Public-Key: (256 bit)
                pub: 
                    04:af:d1:60:3b:19:ec:a2:7b:2b:9d:46:6b:dc:2e:
                    20:81:24:fb:60:24:7d:c0:84:af:0e:ec:25:35:d6:
                    5c:03:3e:07:89:50:8d:98:00:0f:b4:09:c0:14:31:
                    b4:53:5f:51:99:ce:0c:7d:16:01:30:ef:06:ac:e1:
                    eb:3a:46:7b:b0
                ASN1 OID: prime256v1
                NIST CURVE: P-256
        X509v3 extensions:
            X509v3 Subject Key Identifier: 
                22:BE:54:85:99:AA:9F:BE:0C:7A:A6:18:B5:84:64:76:1D:1F:DB:FB
            X509v3 Authority Key Identifier: 
                keyid:22:BE:54:85:99:AA:9F:BE:0C:7A:A6:18:B5:84:64:76:1D:1F:DB:FB

            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Key Usage: critical
                Digital Signature, Certificate Sign, CRL Sign
    Signature Algorithm: ecdsa-with-SHA256
         30:45:02:20:01:43:23:44:38:20:e3:f1:57:b7:18:e3:04:95:
         38:90:27:e3:2e:40:75:9c:2b:22:d2:75:5e:e3:69:98:29:6d:
         02:21:00:e5:ce:b0:72:ee:aa:98:5e:7d:ea:ec:80:af:bc:4b:
         9e:bd:ff:17:9c:c9:c6:b1:37:03:22:c3:e2:df:b9:a0:ab
-----BEGIN CERTIFICATE-----
MIIBwDCCAWagAwIBAgIBATAKBggqhkjOPQQDAjA2MQswCQYDVQQGEwJOTDEUMBIG
A1UECgwLUGhpbGlwcyBIdWUxETAPBgNVBAMMCHJvb3QtaHNiMCAXDTE3MDEwMTAw
MDAwMFoYDzk5OTkxMjMxMjM1OTU5WjA2MQswCQYDVQQGEwJOTDEUMBIGA1UECgwL
UGhpbGlwcyBIdWUxETAPBgNVBAMMCHJvb3QtaHNiMFkwEwYHKoZIzj0CAQYIKoZI
zj0DAQcDQgAEr9FgOxnsonsrnUZr3C4ggST7YCR9wISvDuwlNdZcAz4HiVCNmAAP
tAnAFDG0U19Rmc4MfRYBMO8GrOHrOkZ7sKNjMGEwHQYDVR0OBBYEFCK+VIWZqp++
DHqmGLWEZHYdH9v7MB8GA1UdIwQYMBaAFCK+VIWZqp++DHqmGLWEZHYdH9v7MA8G
A1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMCA0gAMEUC
IAFDI0Q4IOPxV7cY4wSVOJAn4y5AdZwrItJ1XuNpmCltAiEA5c6wcu6qmF596uyA
r7xLnr3/F5zJxrE3AyLD4t+5oKs=
-----END CERTIFICATE-----
```