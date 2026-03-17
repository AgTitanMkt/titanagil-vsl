pipeline {
    agent any

    environment {
        APP_NAME = 'vsl_dashboard'
        DEPLOY_PATH = '/var/www/vsl-dash-python'
        CONTAINER_NAME = 'vsl_dashboard_app'
    }

    stages {

        stage('Clean Workspace') {
            steps {
                cleanWs()
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Gerar .env') {
            steps {
                withCredentials([
                    string(credentialsId: 'VSL_DB_HOST', variable: 'VSL_DB_HOST'),
                    string(credentialsId: 'VSL_DB_DATABASE', variable: 'VSL_DB_DATABASE'),
                    string(credentialsId: 'VSL_DB_USERNAME', variable: 'VSL_DB_USERNAME'),
                    string(credentialsId: 'VSL_DB_PASSWORD', variable: 'VSL_DB_PASSWORD'),
                ]) {
                    sh '''
                    cp .env.example .env

                    echo "DATABASE_URL=mysql+pymysql://${VSL_DB_USERNAME}:${VSL_DB_PASSWORD}@mysql:3306/${VSL_DB_DATABASE}" >> .env
                    echo "PORT=8050" >> .env
                    echo "DEBUG=false" >> .env
                    '''
                }
            }
        }

        stage('Build & Deploy Containers') {
            steps {
                sh '''
                docker compose -p vsl_dashboard up -d --build --remove-orphans
                '''
            }
        }

        stage('Wait for Health Check') {
            steps {
                sh '''
                echo "Aguardando aplicação iniciar..."
                sleep 10

                # Wait up to 60 seconds for health check
                for i in $(seq 1 12); do
                    if docker compose -p vsl_dashboard exec -T vsl_app curl -sf http://localhost:8050/api/health > /dev/null 2>&1; then
                        echo "Aplicação saudável!"
                        exit 0
                    fi
                    echo "Tentativa $i/12 - aguardando..."
                    sleep 5
                done

                echo "ERRO: Aplicação não respondeu ao health check"
                docker compose -p vsl_dashboard logs vsl_app --tail 50
                exit 1
                '''
            }
        }

        stage('Run Database Migrations' ) {
            steps {
                sh '''
                echo "Verificando tabelas do banco..."
                docker compose -p vsl_dashboard exec -T vsl_app python -c "
                from app.models.database import init_db
                init_db()
                print('Database tables OK')
                "
                '''
            }
        }

        stage('Reload Nginx') {
            steps {
                sh '''
                # Copy nginx config if changed
                if [ -f docker/nginx/vsl.conf ]; then
                    sudo cp docker/nginx/vsl.conf /etc/nginx/sites-available/vsl-dashboard
                    sudo ln -sf /etc/nginx/sites-available/vsl-dashboard /etc/nginx/sites-enabled/vsl-dashboard
                    sudo nginx -t && sudo systemctl reload nginx
                    echo "Nginx recarregado com sucesso"
                fi
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh '''
                # Remove dangling images
                docker image prune -f || true
                echo "Deploy concluído com sucesso!"
                '''
            }
        }
    }

    post {
        failure {
            sh '''
            echo "=== LOGS DO CONTAINER ==="
            docker compose -p vsl_dashboard logs vsl_app --tail 50
            '''
        }
        always {
            sh 'echo "Pipeline finalizado: ${currentBuild.result}"'
        }
    }
}