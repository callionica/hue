# hue_bridge_cacert.pem - Hue Bridge CA Certificate

`hue_bridge_cacert.pem` is the CA certificate for the Hue Bridge.

The file was created from the text provided at https://developers.meethue.com/develop/application-design-guidance/using-https/ on 2021-09-23.

Its use is described at https://developers.meethue.com/develop/application-design-guidance/using-https/.

## Making a CURL Request to a Hue Bridge with Certificate Checks
To make a CURL request to a Hue Bridge without using `-k` or `--insecure`, you need to pass
the CA certificate using `--cacert` and you need to provide a mapping from the Hue Bridge ID to its IP address using `--resolve`.

`--cacert` is so that CURL has access to the certificate authority used to issue the Hue Bridge's HTTPS certificate.

`--resolve` is so that the HTTPS certificate can be verified because the HTTPS certificate of the bridge uses the ID as the Common Name (CN) in the certificate.

```
curl --cacert hue_bridge_cacert.pem -X GET https://${id}/api/unauthenticated/config --resolve "${id}:443:${ip}"
```

## The Hue Bridge Signing Certificate

```
openssl x509 -in hue_bridge_cacert.pem -text
```

```
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            3b:b1:52:2d:b6:b1:8a:4b:97:02:58:f3:55:ab:ab:2d:75:a6:17:0e
    Signature Algorithm: ecdsa-with-SHA256
        Issuer: C=NL, O=Philips Hue, CN=root-bridge
        Validity
            Not Before: Jan  1 00:00:00 2017 GMT
            Not After : Jan 19 03:14:07 2038 GMT
        Subject: C=NL, O=Philips Hue, CN=root-bridge
        Subject Public Key Info:
            Public Key Algorithm: id-ecPublicKey
                Public-Key: (256 bit)
                pub: 
                    04:8c:dc:36:b7:1d:80:a6:53:9f:f7:1f:3a:69:37:
                    6f:11:c2:f5:15:4e:b9:40:3c:73:88:ab:c1:a5:6f:
                    57:5d:22:1c:89:b0:1e:42:22:b1:7a:0a:6a:f0:4c:
                    5b:af:db:fa:2c:19:d8:6e:76:b6:55:c6:8a:d0:6d:
                    b6:8c:e2:a4:4e
                ASN1 OID: prime256v1
                NIST CURVE: P-256
        X509v3 extensions:
            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Key Usage: critical
                Digital Signature, Certificate Sign, CRL Sign
            X509v3 Subject Key Identifier: 
                67:63:8D:4C:5A:C3:4F:AA:3C:22:D4:67:29:FA:96:2A:71:C5:1A:64
            X509v3 Authority Key Identifier: 
                keyid:67:63:8D:4C:5A:C3:4F:AA:3C:22:D4:67:29:FA:96:2A:71:C5:1A:64
                DirName:/C=NL/O=Philips Hue/CN=root-bridge
                serial:3B:B1:52:2D:B6:B1:8A:4B:97:02:58:F3:55:AB:AB:2D:75:A6:17:0E

    Signature Algorithm: ecdsa-with-SHA256
         30:45:02:20:40:58:60:43:ac:6b:4e:d3:1f:b1:39:30:99:c6:
         c3:9e:7b:95:59:0e:46:08:ad:d9:19:b5:87:70:76:b0:58:03:
         02:21:00:d4:58:ff:0b:70:0d:e6:9b:05:32:3a:34:ff:f9:ab:
         41:e6:e8:d1:e2:9d:dd:a5:91:c7:ea:50:63:4f:26:93:8f
-----BEGIN CERTIFICATE-----
MIICMjCCAdigAwIBAgIUO7FSLbaxikuXAljzVaurLXWmFw4wCgYIKoZIzj0EAwIw
OTELMAkGA1UEBhMCTkwxFDASBgNVBAoMC1BoaWxpcHMgSHVlMRQwEgYDVQQDDAty
b290LWJyaWRnZTAiGA8yMDE3MDEwMTAwMDAwMFoYDzIwMzgwMTE5MDMxNDA3WjA5
MQswCQYDVQQGEwJOTDEUMBIGA1UECgwLUGhpbGlwcyBIdWUxFDASBgNVBAMMC3Jv
b3QtYnJpZGdlMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEjNw2tx2AplOf9x86
aTdvEcL1FU65QDxziKvBpW9XXSIcibAeQiKxegpq8Exbr9v6LBnYbna2VcaK0G22
jOKkTqOBuTCBtjAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNV
HQ4EFgQUZ2ONTFrDT6o8ItRnKfqWKnHFGmQwdAYDVR0jBG0wa4AUZ2ONTFrDT6o8
ItRnKfqWKnHFGmShPaQ7MDkxCzAJBgNVBAYTAk5MMRQwEgYDVQQKDAtQaGlsaXBz
IEh1ZTEUMBIGA1UEAwwLcm9vdC1icmlkZ2WCFDuxUi22sYpLlwJY81Wrqy11phcO
MAoGCCqGSM49BAMCA0gAMEUCIEBYYEOsa07TH7E5MJnGw557lVkORgit2Rm1h3B2
sFgDAiEA1Fj/C3AN5psFMjo0//mrQebo0eKd3aWRx+pQY08mk48=
-----END CERTIFICATE-----
```